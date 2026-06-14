import React, { useState, useEffect, useRef } from 'react';

export default function AdminConsole() {
  const [logs, setLogs] = useState(["[SYSTEM]: Admin Command Center online. Waiting for WebSocket uplink..."]);
  const [inputCommand, setInputCommand] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Establish a native, full-duplex WebSocket connection to our FastAPI gateway
    socketRef.current = new WebSocket("ws://localhost:8000/api/v1/ws/admin");

    socketRef.current.onopen = () => {
      setLogs((prev) => [...prev, "⚡ WEBSOCKET TUNNEL LOCKED. Full-duplex link established cleanly."]);
    };

    socketRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      const timestamp = new Date().toLocaleTimeString();
      
      if (response.type === "SUCCESS") {
        setLogs((prev) => [...prev, `[${timestamp}] ✅ SYSTEM RESPONSE: ${response.message}`]);
      } else {
        setLogs((prev) => [...prev, `[${timestamp}] ❌ CRITICAL: ${response.message}`]);
      }
    };

    socketRef.current.onclose = () => {
      setLogs((prev) => [...prev, "🔌 Warning: WebSocket connection dropped from server pipeline."]);
    };

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const handleSendCommand = (e) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;

    // Syntax validation check: Expecting something simple like /override 1 Critical
    const parts = inputCommand.split(" ");
    if (parts[0] === "/override" && parts[1] && parts[2]) {
      const payload = {
        command: "/override",
        ticket_id: parseInt(parts[1], 10),
        status: parts[2]
      };

      // Push raw text frame across the active socket line immediately
      socketRef.current.send(JSON.stringify(payload));
      setLogs((prev) => [...prev, `> Executing local frame broadcast: ${inputCommand}`]);
    } else {
      setLogs((prev) => [...prev, `> ⚠️ Syntax Error. Use: /override <ticket_id> <status_name>`]);
    }

    setInputCommand("");
  };

  return (
    <div className="bg-black text-green-400 p-4 font-mono rounded-lg shadow-2xl h-64 flex flex-col justify-between border border-green-900">
      <div className="overflow-y-auto space-y-1 text-xs custom-scrollbar">
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
      <form onSubmit={handleSendCommand} className="mt-2 flex items-center border-t border-green-950 pt-2">
        <span className="text-green-500 mr-2 font-bold">root@ai-saas:~#</span>
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          placeholder="/override <id> <status>"
          className="bg-transparent text-green-300 outline-none flex-grow placeholder-green-800 text-xs"
        />
      </form>
    </div>
  );
}

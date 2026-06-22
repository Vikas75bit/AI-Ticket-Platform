import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Search,
  Activity,
  BarChart3,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Send,
  CheckCircle,
  Trash2,
  LogOut,
  ArrowRight,
  ShieldAlert,
  BrainCircuit,
  Sparkles,
  Loader2,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  TrendingUp,
  MessageSquare,
  X,
  User
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

function App() {
  const [analytics, setAnalytics] = useState(null);
  const [operationsAnalytics, setOperationsAnalytics] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticketFilter, setTicketFilter] = useState("all");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [overrideText, setOverrideText] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [activityFeed, setActivityFeed] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const [selectedCommentTicket, setSelectedCommentTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [readComments, setReadComments] = useState({});
  const [knowledge, setKnowledge] = useState([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [aiReply, setAiReply] = useState("");

  useEffect(() => {
    setReadComments(JSON.parse(localStorage.getItem("read_comments") || "{}"));
  }, []);

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const loadComments = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`);
      if (!response.ok) throw new Error("Failed to load comments");
      const data = await response.json();
      const commentsArray = Array.isArray(data) ? data : [];
      setComments(commentsArray);

      const readMap = JSON.parse(localStorage.getItem("read_comments") || "{}");
      readMap[ticketId] = commentsArray.length;
      localStorage.setItem("read_comments", JSON.stringify(readMap));
      setReadComments(readMap);
    } catch (error) {
      console.error(error);
      setComments([]);
    }
  };

  const sendAdminComment = async () => {
    if (!newComment.trim() || !selectedCommentTicket) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${selectedCommentTicket.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: "admin@gmail.com", message: newComment }),
        }
      );
      if (!response.ok) throw new Error("Failed to post comment");
      setNewComment("");
      loadComments(selectedCommentTicket.id);
      showNotification("Comment posted successfully!", "success");
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const getUnreadCount = (ticket) => {
    const readCount = readComments[ticket.id] || 0;
    const totalCount = ticket.comment_count || 0;
    return Math.max(0, totalCount - readCount);
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const data = await response.json();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOperationsAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/operations`);
      if (!response.ok) throw new Error("Failed to fetch operations analytics");
      const data = await response.json();
      setOperationsAnalytics(data);
    } catch (error) {
      console.error("Operations analytics failed:", error);
    }
  };

  const fetchTickets = () => {
    axios
      .get(`${API_BASE_URL}/tickets`)
      .then((response) => {
        setTickets(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => console.error("Failed to query records stream:", err));
  };

  const fetchKnowledge = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge`);
      const data = await response.json();
      setKnowledge(data || []);
    } catch (error) {
      console.error("Knowledge fetch failed", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
    fetchOperationsAnalytics();
    fetchTickets();
    fetchKnowledge();

    const channel = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          const activity = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            event: payload.eventType,
            ticketId: payload.new?.id || payload.old?.id,
          };
          setActivityFeed((current) => [activity, ...current.slice(0, 9)]);
          fetchTickets();
          fetchAnalytics();
          fetchOperationsAnalytics();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE_URL}/api/v1/tickets/stream`);
    eventSource.onmessage = (event) => {
      try {
        const liveUpdate = JSON.parse(event.data);
        setTickets((prevTickets) =>
          prevTickets.map((ticket) =>
            ticket.id === liveUpdate.ticket_id
              ? { ...ticket, workflow_stage: liveUpdate.status, action_taken: liveUpdate.action_taken }
              : ticket
          )
        );
        fetchAnalytics();
        fetchOperationsAnalytics();
      } catch (err) {
        console.error("Error parsing live update packet:", err);
      }
    };
    eventSource.onerror = (err) => console.error("SSE Streaming connection error...", err);
    return () => eventSource.close();
  }, []);

  const handleApplyOverride = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !overrideText.trim()) return;
    setIsSubmitting(true);
    try {
      await axios.patch(`${API_BASE_URL}/tickets/${selectedTicket.id}/override`, {
        manual_action: overrideText,
      });
      fetchAnalytics();
      fetchOperationsAnalytics();
      fetchTickets();
      setSelectedTicket(null);
      setOverrideText("");
      showNotification("Override applied successfully!", "success");
    } catch (err) {
      showNotification(`Override execution failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerCheckout = async (planName) => {
    setCheckoutLoading(true);
    try {
      showNotification(`Redirecting to secure payment sandbox for ${planName}...`, "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      showNotification(`Payment successful. Account upgraded to ${planName}!`, "success");
      setShowPaywall(false);
    } catch (err) {
      showNotification(`Payment Gateway Interrupted: ${err.message}`, "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const updateStatus = async (ticketId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      showNotification("Ticket status updated successfully.", "success");
      fetchTickets();
    } catch (error) {
      showNotification(`Status update failed: ${error.message}`, "error");
    }
  };

  const updateResolutionNote = async (ticketId, note) => {
    const { error: updateErr } = await supabase.from("tickets").update({ resolution_note: note }).eq("id", ticketId);
    if (updateErr) {
      showNotification(`Saving resolution note failed: ${updateErr.message}`, "error");
      return;
    }
    fetchTickets();
    showNotification("Resolution note saved successfully!", "success");
  };

  const assignTicket = async (ticketId, assignedAgent) => {
    const { error: updateErr } = await supabase.from("tickets").update({ assigned_to: assignedAgent }).eq("id", ticketId);
    if (updateErr) {
      showNotification(`Assignment failed: ${updateErr.message}`, "error");
      return;
    }
    showNotification(assignedAgent ? `Ticket assigned to ${assignedAgent}` : "Ticket unassigned", "success");
    fetchTickets();
  };

  const deleteTicket = async (ticketId) => {
    if (!window.confirm("Permanently delete this ticket? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showNotification("Ticket deleted.", "success");
      fetchTickets();
      fetchAnalytics();
    } catch (err) {
      showNotification(`Delete failed: ${err.message}`, "error");
    }
  };

  const openOverrideModal = (ticket) => {
    setSelectedTicket(ticket);
    setOverrideText("");
    setResolutionNote(ticket.resolution_note || "");
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const filteredTickets = tickets.filter((ticket) => {
    const sender = String(ticket.sender || "");
    const subject = String(ticket.subject || "");
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const matchesSearch = sender.toLowerCase().includes(normalizedSearchTerm) || subject.toLowerCase().includes(normalizedSearchTerm);
    const matchesUrgency = urgencyFilter === "All" || ticket.urgency === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  const queueFiltered = filteredTickets.filter((ticket) => {
    if (ticketFilter === "mine") return ticket.assigned_to === "admin@gmail.com";
    if (ticketFilter === "unassigned") return !ticket.assigned_to;
    return true;
  });

  const RESOLVED_STATUSES = ["Resolved", "Closed"];
  const activeTickets   = queueFiltered.filter((t) => !RESOLVED_STATUSES.includes(t.status));
  const resolvedTickets = queueFiltered.filter((t) =>  RESOLVED_STATUSES.includes(t.status));
  const displayedTickets = queueFiltered; // kept for backward compat

  const assignedTickets = tickets.filter((ticket) => ticket.assigned_to).length;
  const unassignedTickets = tickets.filter((ticket) => !ticket.assigned_to).length;

  const priorityData = [
    { name: "High", value: tickets.filter((ticket) => ticket.urgency === "High").length },
    { name: "Medium", value: tickets.filter((ticket) => ticket.urgency === "Medium").length },
    { name: "Low", value: tickets.filter((ticket) => ticket.urgency === "Low").length },
  ];

  const CHART_COLORS = ["#ef4444", "#f59e0b", "#10b981"];

  const addKnowledge = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      showNotification("Please fill in both fields.", "error");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: knowledgeTitle, content: knowledgeContent }),
      });
      if (!response.ok) throw new Error("Failed to create knowledge article");
      setKnowledgeTitle("");
      setKnowledgeContent("");
      showNotification("Knowledge base article ingested successfully!", "success");
      fetchKnowledge();
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const deleteKnowledge = async (id) => {
    if (!window.confirm("Delete this knowledge article?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      fetchKnowledge();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const generateAiReply = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/suggest-reply`, { method: "POST" });
      const data = await response.json();
      setAiReply(data.reply || "");
    } catch (error) {
      console.error("AI reply generation failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="bg-brand-surface border border-brand-border rounded-lg p-6 text-center max-w-sm">
          <AlertCircle className="w-6 h-6 text-brand-danger mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-brand-text-primary mb-2">Connection Failed</h2>
          <p className="text-xs text-brand-text-secondary mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary font-medium text-xs rounded-md transition-colors">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "Open": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "In Progress": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Resolved": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Closed": return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
      default: return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text-primary pb-16 font-sans">
      {/* Global Notifications */}
      <AnimatePresence>
        {notification.message && (
          <motion.div initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -20, x: "-50%" }} className="fixed top-4 left-1/2 z-50 max-w-sm w-full px-4">
            <div className={`px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md flex items-start gap-3 ${
              notification.type === "success" ? "bg-brand-surface border-brand-success/20 text-brand-success" : "bg-brand-surface border-brand-danger/20 text-brand-danger"
            }`}>
              {notification.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <p className="flex-1 text-sm font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-14 border-b border-brand-border bg-brand-bg sticky top-0 z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-brand-surface border border-brand-border">
            <BrainCircuit className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-brand-text-primary">
            AI Operations
          </span>
          <span className="hidden sm:flex items-center ml-2 px-2 py-0.5 rounded bg-brand-surface border border-brand-border text-[10px] font-medium text-brand-text-secondary">
            Admin Mode
          </span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-medium text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer">
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* KPI Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Volume", val: analytics.total_tickets },
              { label: "Critical Escalations", val: analytics.high_priority_tickets, color: "text-brand-danger" },
              { label: "AI Triage Status", val: analytics.system_status, color: "text-brand-success" },
              { label: "Assigned Queue", val: assignedTickets },
              { label: "Unassigned", val: unassignedTickets, color: "text-brand-warning" }
            ].map((card, idx) => (
              <div key={idx} className="bg-brand-surface border border-brand-border rounded-lg p-4 shadow-sm flex flex-col justify-between h-[100px]">
                <h3 className="text-xs font-medium text-brand-text-secondary">{card.label}</h3>
                <div className={`text-2xl font-semibold tracking-tight ${card.color || 'text-brand-text-primary'}`}>{card.val}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Analytics Overview */}
            {operationsAnalytics && (
              <div className="bg-brand-surface border border-brand-border rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  <h2 className="text-sm font-semibold text-brand-text-primary">Performance Analytics</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {[
                    { label: "Avg Resolution", val: `${operationsAnalytics.avg_resolution_hours}h` },
                    { label: "Top Department", val: operationsAnalytics.top_department },
                    { label: "Common Urgency", val: operationsAnalytics.most_common_urgency },
                    { label: "Resolved Today", val: operationsAnalytics.resolved_today }
                  ].map((stat, i) => (
                    <div key={i}>
                      <div className="text-[10px] font-medium text-brand-text-secondary uppercase tracking-wide mb-1">{stat.label}</div>
                      <div className="text-sm font-semibold text-brand-text-primary truncate" title={stat.val}>{stat.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

             {/* Charts */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border rounded-lg p-5 shadow-sm h-[280px] flex flex-col">
                <h3 className="text-xs font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-brand-text-secondary" />
                  Priority Distribution
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {priorityData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", fontSize: "11px", color: "#fafafa" }} itemStyle={{color: '#fafafa'}} />
                      <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: "10px", color: "#a1a1aa" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-lg p-5 shadow-sm h-[280px] flex flex-col">
                <h3 className="text-xs font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-brand-text-secondary" />
                  Volume by Priority
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#a1a1aa" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#27272a', opacity: 0.4}} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", fontSize: "11px", color: "#fafafa" }} />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {priorityData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Active Ticket Queue */}
            <div className="bg-brand-surface border border-brand-border rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-brand-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-surface">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-text-secondary" />
                  <h2 className="text-sm font-semibold text-brand-text-primary">Ticket Queue</h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="flex bg-brand-bg border border-brand-border rounded p-0.5">
                    {[
                      { key: "all", label: "All" },
                      { key: "mine", label: "My Desk" },
                      { key: "unassigned", label: "Unassigned" }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setTicketFilter(tab.key)}
                        className={`px-2.5 py-1 rounded-sm text-[10px] font-medium transition-colors ${ticketFilter === tab.key ? "bg-brand-surface text-brand-text-primary shadow-sm" : "text-brand-text-secondary hover:text-brand-text-primary"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-secondary" />
                    <input
                      type="text"
                      placeholder="Search tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-brand-bg border border-brand-border rounded text-xs text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-xs text-brand-text-primary focus:outline-none"
                  >
                    <option value="All">All Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-bg text-[10px] font-medium text-brand-text-secondary">
                      <th className="px-4 py-2.5 font-medium">Issue</th>
                      <th className="px-4 py-2.5 font-medium">Status & Priority</th>
                      <th className="px-4 py-2.5 font-medium">AI Triage</th>
                      <th className="px-4 py-2.5 font-medium">Assignment</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {/* ── Active tickets ── */}
                    {activeTickets.length === 0 && resolvedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-12 text-center text-brand-text-secondary">
                          No tickets match your current filters.
                        </td>
                      </tr>
                    ) : activeTickets.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-brand-text-secondary text-xs">
                          All tickets resolved — queue clear.
                        </td>
                      </tr>
                    ) : (
                      activeTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-brand-bg/50 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="font-medium text-brand-text-primary max-w-[200px] truncate mb-0.5 flex items-center gap-2">
                              {ticket.subject}
                              {getUnreadCount(ticket) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0"/>}
                            </div>
                            <div className="text-[10px] text-brand-text-secondary truncate max-w-[200px]">{ticket.sender}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getStatusBadgeStyles(ticket.status)}`}>
                                {ticket.status || "Open"}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${ticket.urgency === "High" ? "bg-brand-danger/10 text-brand-danger" : ticket.urgency === "Medium" ? "bg-brand-warning/10 text-brand-warning" : "bg-brand-success/10 text-brand-success"}`}>
                                {ticket.urgency || "Low"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-brand-text-primary font-medium">{ticket.department}</span>
                              {ticket.workflow_stage && (
                                <span className={`px-1 py-0.2 rounded text-[8px] font-mono border ${
                                  ticket.workflow_stage === "Queued" ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" :
                                  ticket.workflow_stage === "Knowledge Matched" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                  ticket.workflow_stage === "LLM Drafting Complete" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}>
                                  {ticket.workflow_stage}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-brand-text-secondary mt-0.5 max-w-[150px] truncate" title={ticket.action_taken}>
                              {ticket.action_taken || "Awaiting triage"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={ticket.assigned_to || ""}
                              onChange={(e) => assignTicket(ticket.id, e.target.value)}
                              className="bg-brand-bg border border-brand-border rounded px-2 py-1 text-[10px] text-brand-text-primary focus:outline-none w-[120px]"
                            >
                              <option value="">Unassigned</option>
                              <option value="admin@gmail.com">admin@gmail.com</option>
                            </select>
                            <div className="mt-1.5">
                               <select
                                  value={ticket.status || "Open"}
                                  onChange={(e) => updateStatus(ticket.id, e.target.value)}
                                  className="bg-brand-bg border border-transparent hover:border-brand-border rounded px-1 text-[10px] text-brand-text-secondary focus:outline-none w-[120px] transition-colors"
                                >
                                  <option value="Open">Set Open</option>
                                  <option value="In Progress">Set In Progress</option>
                                  <option value="Resolved">Set Resolved</option>
                                  <option value="Closed">Set Closed</option>
                                </select>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openOverrideModal(ticket)}
                                  className="px-2 py-1 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary text-[10px] font-medium rounded transition-colors"
                                >
                                  Override
                                </button>
                                <button
                                  onClick={() => { setSelectedCommentTicket(ticket); loadComments(ticket.id); setAiReply(""); }}
                                  className="px-2 py-1 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white text-[10px] font-medium rounded transition-colors"
                                >
                                  Discuss
                                </button>
                                <button
                                  onClick={() => deleteTicket(ticket.id)}
                                  className="px-2 py-1 bg-brand-danger/10 text-brand-danger hover:bg-brand-danger hover:text-white text-[10px] font-medium rounded transition-colors"
                                  title="Delete ticket"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}

                    {/* ── Resolved / Closed section ── */}
                    {resolvedTickets.length > 0 && (
                      <>
                        <tr>
                          <td colSpan="5" className="px-4 py-2 bg-brand-bg/60 border-t-2 border-brand-border/60">
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-brand-text-muted">
                              <CheckCircle className="w-3 h-3 text-brand-success" />
                              Resolved &amp; Closed ({resolvedTickets.length})
                            </div>
                          </td>
                        </tr>
                        {resolvedTickets.map((ticket) => (
                          <tr key={ticket.id} className="opacity-50 hover:opacity-80 transition-opacity group">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-brand-text-secondary max-w-[200px] truncate mb-0.5 text-xs line-through">
                                {ticket.subject}
                              </div>
                              <div className="text-[10px] text-brand-text-muted truncate max-w-[200px]">{ticket.sender}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getStatusBadgeStyles(ticket.status)}`}>
                                {ticket.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-[10px] text-brand-text-muted">{ticket.department}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-[10px] text-brand-text-muted">{ticket.assigned_to || "—"}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setSelectedCommentTicket(ticket); loadComments(ticket.id); setAiReply(""); }}
                                  className="px-2 py-1 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white text-[10px] font-medium rounded transition-colors"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => deleteTicket(ticket.id)}
                                  className="px-2 py-1 bg-brand-danger/10 text-brand-danger hover:bg-brand-danger hover:text-white text-[10px] font-medium rounded transition-colors"
                                  title="Delete ticket"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Realtime Event Feed */}
            {activityFeed.length > 0 && (
              <div className="bg-brand-surface border border-brand-border rounded-lg shadow-sm flex flex-col max-h-[300px]">
                <div className="p-4 border-b border-brand-border flex justify-between items-center bg-brand-bg rounded-t-lg">
                  <h3 className="text-xs font-semibold text-brand-text-primary flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-success"></div>
                    Event Stream
                  </h3>
                </div>
                <div className="overflow-y-auto p-2 space-y-1">
                  {activityFeed.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-brand-bg text-[10px] font-mono transition-colors">
                       <span className="text-brand-text-secondary shrink-0">{item.time}</span>
                       <span className="text-brand-primary shrink-0 uppercase">{item.event}</span>
                       <span className="text-brand-text-secondary truncate">ID: {item.ticketId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge Base Ingestion */}
            <div className="bg-brand-surface border border-brand-border rounded-lg shadow-sm">
              <div className="p-4 border-b border-brand-border bg-brand-bg rounded-t-lg">
                <h3 className="text-xs font-semibold text-brand-text-primary flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-brand-text-secondary" />
                  Knowledge Base Sync
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Article Title"
                  value={knowledgeTitle}
                  onChange={(e) => setKnowledgeTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-xs text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary"
                />
                <textarea
                  placeholder="Context data for AI..."
                  value={knowledgeContent}
                  onChange={(e) => setKnowledgeContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-xs text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary resize-none"
                />
                <button
                  onClick={addKnowledge}
                  className="w-full py-2 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary text-xs font-medium rounded-md transition-colors"
                >
                  Ingest Context
                </button>
              </div>

              {knowledge.length > 0 && (
                <div className="border-t border-brand-border p-2 max-h-[200px] overflow-y-auto">
                   {knowledge.map((item) => (
                      <div key={item.id} className="p-3 hover:bg-brand-bg rounded-md group flex items-start justify-between gap-3 transition-colors">
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-medium text-brand-text-primary truncate">{item.title}</h4>
                          <p className="text-[10px] text-brand-text-secondary truncate mt-0.5">{item.content}</p>
                        </div>
                        <button onClick={() => deleteKnowledge(item.id)} className="p-1 text-brand-text-secondary hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Discussion Modal */}
      <AnimatePresence>
        {selectedCommentTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm" onClick={() => setSelectedCommentTicket(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-brand-surface border border-brand-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-brand-border flex items-center justify-between shrink-0">
                 <div>
                   <h2 className="text-sm font-semibold text-brand-text-primary">Thread: {selectedCommentTicket.subject}</h2>
                   <p className="text-[10px] text-brand-text-secondary">#{selectedCommentTicket.id} &middot; {selectedCommentTicket.sender}</p>
                 </div>
                 <button onClick={() => setSelectedCommentTicket(null)} className="p-1.5 text-brand-text-secondary hover:text-brand-text-primary rounded"><X className="w-4 h-4"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {comments.length === 0 ? (
                    <div className="text-center text-sm text-brand-text-secondary py-8">No messages in this thread yet.</div>
                 ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                         <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border ${comment.sender === 'admin@gmail.com' ? 'bg-brand-primary/10 border-brand-primary/20' : 'bg-brand-surface border-brand-border'}`}>
                            {comment.sender === 'admin@gmail.com' ? <Sparkles className="w-4 h-4 text-brand-primary"/> : <User className="w-4 h-4 text-brand-text-secondary"/>}
                         </div>
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-xs font-medium text-brand-text-primary">{comment.sender}</span>
                               <span className="text-[10px] text-brand-text-secondary">{comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}</span>
                            </div>
                            <div className="text-sm text-brand-text-primary leading-relaxed">
                               {comment.message}
                            </div>
                         </div>
                      </div>
                    ))
                 )}
              </div>
              <div className="p-4 border-t border-brand-border bg-brand-bg rounded-b-xl shrink-0 space-y-3">
                 <div className="flex gap-2">
                    <button onClick={() => generateAiReply(selectedCommentTicket.id)} className="px-3 py-1.5 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-xs font-medium text-brand-text-primary rounded-md flex items-center gap-2 transition-colors">
                      <BrainCircuit className="w-3.5 h-3.5 text-brand-primary" />
                      Suggest Reply
                    </button>
                 </div>
                 <AnimatePresence>
                    {aiReply && (
                       <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden">
                          <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-md">
                             <div className="text-xs text-brand-text-secondary mb-2 whitespace-pre-wrap">{aiReply}</div>
                             <button onClick={() => setNewComment(aiReply)} className="text-[10px] font-medium bg-brand-primary text-white px-2 py-1 rounded transition-colors hover:bg-brand-primary/90">Use Suggestion</button>
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>
                 <div className="flex gap-2 relative">
                    <textarea value={newComment} onChange={(e)=>setNewComment(e.target.value)} placeholder="Type a response..." rows={1} className="flex-1 bg-brand-surface border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary resize-none min-h-[40px] max-h-[120px]" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminComment(); }}} />
                    <button onClick={sendAdminComment} disabled={!newComment.trim()} className="shrink-0 px-3 py-2 bg-brand-primary text-white rounded-md disabled:opacity-50 transition-colors h-[40px]">
                      <Send className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Override Modal */}
      <AnimatePresence>
        {selectedTicket && !selectedCommentTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-bg">
                  <div className="flex items-center gap-2 text-brand-text-primary">
                    <ShieldAlert className="w-4 h-4 text-brand-warning" />
                    <span className="text-sm font-semibold">Intervention Console</span>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="text-brand-text-secondary hover:text-brand-text-primary"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                   <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-medium text-brand-text-secondary mb-1">TICKET SUBJECT</div>
                        <div className="text-sm text-brand-text-primary">{selectedTicket.subject}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-brand-text-secondary mb-1">AI ACTION</div>
                        <div className="text-xs font-mono text-brand-text-secondary bg-brand-bg p-2 rounded border border-brand-border">
                          {selectedTicket.action_taken || "Pending"}
                        </div>
                      </div>
                   </div>
                   <div className="space-y-4 pt-4 border-t border-brand-border">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-brand-text-primary">System Override Log</label>
                        <textarea value={overrideText} onChange={e=>setOverrideText(e.target.value)} placeholder="Explain the manual override action..." rows={2} className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary resize-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-brand-text-primary">Resolution Note (Customer Facing)</label>
                        <textarea value={resolutionNote} onChange={e=>setResolutionNote(e.target.value)} placeholder="Update the customer on the outcome..." rows={2} className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary resize-none" />
                      </div>
                   </div>
                </div>
                <div className="p-4 border-t border-brand-border bg-brand-bg flex justify-end gap-3">
                   <button onClick={() => { updateResolutionNote(selectedTicket.id, resolutionNote); setSelectedTicket(null); }} className="px-4 py-2 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary text-xs font-medium rounded-md transition-colors">
                     Save Resolution Only
                   </button>
                   <button onClick={handleApplyOverride} disabled={isSubmitting || !overrideText.trim()} className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white disabled:opacity-50 text-xs font-medium rounded-md transition-colors">
                     {isSubmitting ? "Applying..." : "Apply Full Override"}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

       {/* Paywall Modal (Simplified) */}
       <AnimatePresence>
        {showPaywall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-brand-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 relative">
              <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text-primary"><X className="w-4 h-4"/></button>
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-md">Upgrade Required</span>
                <h2 className="text-xl font-semibold mt-3 text-brand-text-primary">Unlock Priority Operations</h2>
              </div>
              <button onClick={() => handleTriggerCheckout("Growth")} disabled={checkoutLoading} className="w-full py-2 bg-brand-primary text-white text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-colors">
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Upgrade Workspace"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;

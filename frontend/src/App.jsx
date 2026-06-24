import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BarChart3,
  BookOpen,
  AlertCircle,
  Send,
  CheckCircle,
  Trash2,
  LogOut,
  BrainCircuit,
  Sparkles,
  Loader2,
  X,
  User,
  Inbox,
  Calendar,
  Mail,
  Building2,
  Tag,
  Activity,
  TrendingUp,
  Plus,
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

const STATUS_CONFIG = {
  Open:          { color: "#f97316", bg: "rgba(249,115,22,0.08)", label: "Open" },
  "In Progress": { color: "#6366f1", bg: "rgba(99,102,241,0.08)", label: "In Progress" },
  Resolved:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  label: "Resolved" },
  Closed:        { color: "#52525b", bg: "rgba(82,82,91,0.08)",   label: "Closed" },
};

const PRIORITY_CONFIG = {
  Critical: { color: "#ef4444", dot: "#ef4444", label: "Critical" },
  High:     { color: "#ef4444", dot: "#ef4444", label: "High" },
  Medium:   { color: "#f59e0b", dot: "#f59e0b", label: "Medium" },
  Low:      { color: "#22c55e", dot: "#22c55e", label: "Low" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const CHART_COLORS = ["#ef4444", "#f59e0b", "#22c55e"];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Open;
  return (
    <span
      style={{
        color: cfg.color,
        borderColor: `${cfg.color}25`,
        backgroundColor: `${cfg.color}10`,
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium leading-none whitespace-nowrap"
    >
      <span style={{ background: cfg.color }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  return (
    <span
      style={{
        color: cfg.color,
        borderColor: `${cfg.color}25`,
        backgroundColor: `${cfg.color}10`,
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-none uppercase tracking-wider whitespace-nowrap shrink-0"
    >
      {cfg.label}
    </span>
  );
}


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

  const [detailTicketId, setDetailTicketId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [readComments, setReadComments] = useState({});
  const [knowledge, setKnowledge] = useState([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const [activeView, setActiveView] = useState("inbox");

  const activeDetailTicket = detailTicketId
    ? tickets.find((t) => t.id === detailTicketId) || null
    : null;

  const paneRef = useRef(null);

  // Close details panel on outside click (excluding clicking ticket rows or panel itself)
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        detailTicketId &&
        paneRef.current &&
        !paneRef.current.contains(e.target) &&
        !e.target.closest("tr")
      ) {
        setDetailTicketId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [detailTicketId]);

  // Close detail pane on Esc
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (showOverrideModal) {
          setShowOverrideModal(false);
          setSelectedTicket(null);
        } else if (detailTicketId) {
          setDetailTicketId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [detailTicketId, showOverrideModal]);

  useEffect(() => {
    setReadComments(JSON.parse(localStorage.getItem("read_comments") || "{}"));
  }, []);

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 4000);
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
    } catch (err) {
      console.error(err);
      setComments([]);
    }
  };

  const sendAdminComment = async () => {
    if (!newComment.trim() || !detailTicketId) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${detailTicketId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: "admin@gmail.com", message: newComment }),
        }
      );
      if (!response.ok) throw new Error("Failed to post comment");
      setNewComment("");
      loadComments(detailTicketId);
      showNotification("Comment posted.", "success");
    } catch (err) {
      console.error(err);
      showNotification(err.message, "error");
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
    } catch (err) {
      console.error("Operations analytics fetch failed:", err);
    }
  };

  const fetchTickets = () => {
    axios
      .get(`${API_BASE_URL}/tickets`)
      .then((response) => {
        setTickets(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => console.error("Failed to fetch tickets:", err));
  };

  const fetchKnowledge = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge`);
      const data = await response.json();
      setKnowledge(data || []);
    } catch (err) {
      console.error("Knowledge fetch failed:", err);
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
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            event: payload.eventType,
            ticketId: payload.new?.id || payload.old?.id,
          };
          setActivityFeed((current) => [activity, ...current.slice(0, 19)]);
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
        setTickets((prev) =>
          prev.map((t) =>
            t.id === liveUpdate.ticket_id
              ? { ...t, workflow_stage: liveUpdate.status, action_taken: liveUpdate.action_taken }
              : t
          )
        );
        fetchAnalytics();
        fetchOperationsAnalytics();
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };
    eventSource.onerror = () => {};
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
      setShowOverrideModal(false);
      setOverrideText("");
      showNotification("Override applied.", "success");
    } catch (err) {
      showNotification(`Override failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerCheckout = async (planName) => {
    setCheckoutLoading(true);
    try {
      showNotification(`Redirecting to payment for ${planName}...`, "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      showNotification(`Account upgraded to ${planName}.`, "success");
      setShowPaywall(false);
    } catch (err) {
      showNotification(`Payment failed: ${err.message}`, "error");
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
      showNotification(`Status → ${newStatus}`, "success");
      fetchTickets();
    } catch (err) {
      showNotification(`Status update failed: ${err.message}`, "error");
    }
  };

  const updateResolutionNote = async (ticketId, note) => {
    const { error: updateErr } = await supabase.from("tickets").update({ resolution_note: note }).eq("id", ticketId);
    if (updateErr) {
      showNotification(`Failed to save note: ${updateErr.message}`, "error");
      return;
    }
    fetchTickets();
    showNotification("Resolution note saved.", "success");
  };

  const assignTicket = async (ticketId, assignedAgent) => {
    const { error: updateErr } = await supabase.from("tickets").update({ assigned_to: assignedAgent }).eq("id", ticketId);
    if (updateErr) {
      showNotification(`Assignment failed: ${updateErr.message}`, "error");
      return;
    }
    showNotification(assignedAgent ? `Assigned to ${assignedAgent}` : "Unassigned", "success");
    fetchTickets();
  };

  const deleteTicket = async (ticketId) => {
    if (!window.confirm("Delete this ticket? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showNotification("Ticket deleted.", "success");
      if (detailTicketId === ticketId) {
        setDetailTicketId(null);
        setComments([]);
      }
      fetchTickets();
      fetchAnalytics();
    } catch (err) {
      showNotification(`Delete failed: ${err.message}`, "error");
    }
  };

  const handleResolve = async (ticketId) => {
    await updateStatus(ticketId, "Resolved");
  };

  const handleEscalate = async (ticketId) => {
    try {
      const { error: updateErr } = await supabase
        .from("tickets")
        .update({ urgency: "Critical" })
        .eq("id", ticketId);
      if (updateErr) throw updateErr;
      showNotification("Ticket escalated to Critical priority.", "success");
      fetchTickets();
    } catch (err) {
      showNotification(`Escalation failed: ${err.message}`, "error");
    }
  };

  const getTimelineEvents = (ticket, ticketComments) => {
    const events = [];

    // 1. Created Event
    if (ticket.created_at) {
      events.push({
        type: "created",
        title: "Ticket created",
        description: `Customer submitted via email`,
        time: ticket.created_at,
        icon: Mail,
        iconColor: "text-brand-text-muted",
      });
    }

    // 2. AI Recommendation Event
    if (ticket.created_at) {
      events.push({
        type: "ai_analysis",
        title: "AI Analysis Completed",
        description: `Auto-assigned department to "${ticket.department || "Operations"}" and priority to "${ticket.urgency}"`,
        time: new Date(new Date(ticket.created_at).getTime() + 1500).toISOString(),
        icon: BrainCircuit,
        iconColor: "text-brand-primary",
      });
    }

    // 3. Assignee Change Event (if assigned)
    if (ticket.assigned_to) {
      events.push({
        type: "assigned",
        title: "Ticket assigned",
        description: `Assigned to ${ticket.assigned_to}`,
        time: ticket.updated_at || ticket.created_at,
        icon: User,
        iconColor: "text-blue-400",
      });
    }

    // 4. Status / Resolution Events
    if (ticket.status !== "Open") {
      events.push({
        type: "status_change",
        title: `Status changed to ${ticket.status}`,
        description: ticket.resolution_note ? `Note: ${ticket.resolution_note}` : `Updated by support system`,
        time: ticket.updated_at || ticket.created_at,
        icon: CheckCircle,
        iconColor: ticket.status === "Resolved" || ticket.status === "Closed" ? "text-brand-success" : "text-brand-primary",
      });
    }

    // 5. Comments
    if (ticketComments && ticketComments.length > 0) {
      ticketComments.forEach((comment) => {
        events.push({
          type: "comment",
          title: `Reply from ${comment.sender}`,
          description: comment.message,
          time: comment.created_at,
          icon: Send,
          iconColor: comment.sender === "admin@gmail.com" ? "text-brand-primary" : "text-brand-text-secondary",
        });
      });
    }

    // Sort oldest first for a standard chronological timeline
    return events.sort((a, b) => new Date(a.time) - new Date(b.time));
  };

  const openOverrideModal = (ticket) => {
    setSelectedTicket(ticket);
    setOverrideText("");
    setResolutionNote(ticket.resolution_note || "");
    setShowOverrideModal(true);
  };

  const handleLogout = async () => await supabase.auth.signOut();

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
      if (!response.ok) throw new Error("Failed to create article");
      setKnowledgeTitle("");
      setKnowledgeContent("");
      showNotification("Article added.", "success");
      fetchKnowledge();
    } catch (err) {
      console.error(err);
      showNotification(err.message, "error");
    }
  };

  const deleteKnowledge = async (id) => {
    if (!window.confirm("Delete this article?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      fetchKnowledge();
      showNotification("Article deleted.", "success");
    } catch (err) {
      console.error(err);
      showNotification(err.message, "error");
    }
  };

  const generateAiReply = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/suggest-reply`, { method: "POST" });
      const data = await response.json();
      setAiReply(data.reply || "");
    } catch (err) {
      console.error("AI reply generation failed:", err);
    }
  };

  const openDetail = (ticket) => {
    setDetailTicketId(ticket.id);
    loadComments(ticket.id);
    setAiReply("");
    setNewComment("");
  };

  const closeDetail = () => {
    setDetailTicketId(null);
    setComments([]);
    setAiReply("");
    setNewComment("");
  };

  const filteredTickets = tickets.filter((ticket) => {
    const sender = String(ticket.sender || "");
    const subject = String(ticket.subject || "");
    const term = searchTerm.toLowerCase();
    const matchesSearch = sender.toLowerCase().includes(term) || subject.toLowerCase().includes(term);
    const matchesUrgency = urgencyFilter === "All" || ticket.urgency === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  const queueFiltered = filteredTickets.filter((ticket) => {
    if (ticketFilter === "mine") return ticket.assigned_to === "admin@gmail.com";
    if (ticketFilter === "unassigned") return !ticket.assigned_to;
    return true;
  });

  const RESOLVED_STATUSES = ["Resolved", "Closed"];
  const activeTickets = queueFiltered.filter((t) => !RESOLVED_STATUSES.includes(t.status));
  const resolvedTickets = queueFiltered.filter((t) => RESOLVED_STATUSES.includes(t.status));
  const allDisplayed = [...activeTickets, ...resolvedTickets];

  const assignedTickets = tickets.filter((t) => t.assigned_to).length;
  const unassignedTickets = tickets.filter((t) => !t.assigned_to).length;

  const priorityData = [
    { name: "High", value: tickets.filter((t) => t.urgency === "High").length },
    { name: "Medium", value: tickets.filter((t) => t.urgency === "Medium").length },
    { name: "Low", value: tickets.filter((t) => t.urgency === "Low").length },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-5 h-5 text-brand-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center max-w-xs">
          <AlertCircle className="w-6 h-6 text-brand-text-muted mx-auto mb-3" />
          <p className="text-[13px] text-brand-text-secondary mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 bg-brand-surface border border-brand-border rounded-md text-[13px] text-brand-text-primary hover:bg-brand-elevated transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { key: "inbox", label: "Inbox", icon: Inbox },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "knowledge", label: "Knowledge", icon: BookOpen },
  ];

  /* ── Column helper for the ticket table ── */
  const thClass = "px-4 py-2 text-left text-[11px] font-medium text-brand-text-muted uppercase tracking-wider";

  return (
    <div className="h-screen flex flex-col bg-brand-bg text-brand-text-primary overflow-hidden">

      {/* Toast */}
      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full px-4"
          >
            <div className={`px-4 py-2 rounded-md border flex items-center gap-2 text-[13px] font-medium ${
              notification.type === "success"
                ? "bg-brand-surface border-brand-success/20 text-brand-success"
                : "bg-brand-surface border-brand-danger/20 text-brand-danger"
            }`}>
              {notification.type === "success"
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-11 border-b border-brand-border bg-brand-bg flex items-center justify-between px-4 shrink-0 z-40">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand-primary flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 5h10M3 8h7M3 11h4" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold tracking-tight">HelpdeskAI</span>
          </div>
          <nav className="flex items-center">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                  activeView === item.key
                    ? "text-brand-text-primary bg-brand-surface"
                    : "text-brand-text-muted hover:text-brand-text-secondary"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-[12px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      {/* ═══ INBOX VIEW ═══ */}
      {activeView === "inbox" && (
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* Toolbar */}
          <div className="px-4 py-2 border-b border-brand-border flex items-center gap-3 shrink-0 bg-brand-bg">
            <div className="flex bg-brand-surface border border-brand-border rounded p-0.5">
              {[
                { key: "all", label: `All (${queueFiltered.length})` },
                { key: "mine", label: "Mine" },
                { key: "unassigned", label: "Unassigned" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTicketFilter(tab.key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    ticketFilter === tab.key
                      ? "bg-brand-elevated text-brand-text-primary"
                      : "text-brand-text-muted hover:text-brand-text-secondary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="bg-brand-surface border border-brand-border rounded px-2 py-1 text-[11px] text-brand-text-secondary focus:outline-none"
            >
              <option value="All">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-3 py-1 bg-brand-surface border border-brand-border rounded text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong transition-colors"
              />
            </div>
            <div className="ml-auto text-[11px] text-brand-text-muted">
              {allDisplayed.length} ticket{allDisplayed.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Workspace Area: Left List + Right Detail */}
          <div className="flex-1 flex overflow-hidden relative w-full h-full">

            {/* Ticket Queue List */}
            <div className="flex-1 min-w-0 overflow-y-auto h-full bg-brand-bg relative">
              {allDisplayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Inbox className="w-8 h-8 text-brand-text-muted mb-3" />
                  <p className="text-[13px] text-brand-text-muted">No tickets match your filters.</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-brand-bg border-b border-brand-border">
                    <tr>
                      <th className={thClass} style={{ width: "40%" }}>Subject</th>
                      <th className={thClass} style={{ width: "10%" }}>Priority</th>
                      <th className={thClass} style={{ width: "12%" }}>Status</th>
                      <th className={`${thClass} ${activeDetailTicket ? "hidden xl:table-cell" : ""}`} style={{ width: "14%" }}>Department</th>
                      <th className={`${thClass} ${activeDetailTicket ? "hidden lg:table-cell" : ""}`} style={{ width: "14%" }}>Assignee</th>
                      <th className={`${thClass} text-right`} style={{ width: "10%" }}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDisplayed.map((ticket) => {
                      const isActive = detailTicketId === ticket.id;
                      const isResolved = RESOLVED_STATUSES.includes(ticket.status);
                      const unread = getUnreadCount(ticket);
                      return (
                        <tr
                          key={ticket.id}
                          onClick={() => openDetail(ticket)}
                          className={`border-b border-brand-border cursor-pointer transition-all duration-150 ${
                            isActive
                              ? "bg-brand-primary/[0.06] border-l-2 border-brand-primary"
                              : "hover:bg-brand-surface/40 border-l-2 border-transparent"
                          } ${isResolved ? "opacity-50" : ""}`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {unread > 0 && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0 animate-pulse" />}
                              <span className={`text-[13px] truncate ${isResolved ? "line-through text-brand-text-muted" : "text-brand-text-primary font-medium"}`}>
                                {ticket.subject}
                              </span>
                            </div>
                            <div className="text-[11px] text-brand-text-muted truncate mt-0.5 pl-[14px]">
                              {ticket.sender}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <PriorityBadge priority={ticket.urgency} />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={ticket.status} />
                          </td>
                          <td className={`px-4 py-2.5 ${activeDetailTicket ? "hidden xl:table-cell" : ""}`}>
                            <span className="text-[12px] text-brand-text-secondary">{ticket.department || "—"}</span>
                          </td>
                          <td className={`px-4 py-2.5 ${activeDetailTicket ? "hidden lg:table-cell" : ""}`}>
                            <span className="text-[12px] text-brand-text-secondary truncate block max-w-[140px]">
                              {ticket.assigned_to || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-[11px] text-brand-text-muted whitespace-nowrap">
                              {timeAgo(ticket.updated_at || ticket.created_at)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Slide-over Detail Panel */}
            <AnimatePresence>
              {activeDetailTicket && (
                <motion.aside
                  ref={paneRef}
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute lg:relative top-0 right-0 bottom-0 w-[600px] max-w-full bg-brand-surface border-l border-brand-border z-30 flex flex-col shadow-2xl"
                >
                  {/* Panel Header */}
                  <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between shrink-0 bg-brand-surface">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] font-mono bg-brand-elevated text-brand-text-secondary px-1.5 py-0.5 rounded border border-brand-border">
                        #{activeDetailTicket.id}
                      </span>
                      <span className="text-brand-text-muted">·</span>
                      <StatusBadge status={activeDetailTicket.status} />
                      <span className="text-brand-text-muted">·</span>
                      <span className="text-[12px] text-brand-text-secondary truncate font-medium">
                        {activeDetailTicket.workflow_stage || "Queued"}
                      </span>
                    </div>
                    <button
                      onClick={closeDetail}
                      className="p-1 text-brand-text-muted hover:text-brand-text-primary rounded-full hover:bg-brand-elevated transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Panel Body */}
                  <div className="flex-1 overflow-y-auto bg-brand-bg/50">
                    <div className="px-6 py-5 space-y-6">

                      {/* Title */}
                      <div>
                        <h2 className="text-[18px] font-bold text-brand-text-primary leading-snug tracking-tight">
                          {activeDetailTicket.subject}
                        </h2>
                      </div>

                      {/* Section 1: Metadata Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-4 p-4 bg-brand-surface/40 rounded-lg border border-brand-border/60">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Customer</div>
                          <div className="text-[12px] text-brand-text-primary font-medium truncate" title={activeDetailTicket.sender}>
                            {activeDetailTicket.sender}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Created</div>
                          <div className="text-[12px] text-brand-text-primary font-medium">
                            {formatDate(activeDetailTicket.created_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Priority</div>
                          <div className="flex items-center mt-0.5">
                            <PriorityBadge priority={activeDetailTicket.urgency} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Department</div>
                          <div className="text-[12px] text-brand-text-primary font-medium">
                            {activeDetailTicket.department || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Assignee</div>
                          <div className="text-[12px] text-brand-text-primary font-medium truncate">
                            {activeDetailTicket.assigned_to || "Unassigned"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-brand-text-muted mb-1 tracking-wider">Stage</div>
                          <div className="text-[12px] text-brand-text-primary font-medium">
                            {activeDetailTicket.workflow_stage || "Queued"}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Customer Message */}
                      <div className="space-y-2">
                        <h3 className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">Customer Message</h3>
                        <div className="bg-brand-surface/20 border border-brand-border/40 rounded-lg p-4">
                          <p className="text-[13px] text-brand-text-secondary leading-relaxed whitespace-pre-wrap font-normal select-text">
                            {activeDetailTicket.description || "No description provided."}
                          </p>
                        </div>
                      </div>

                      {/* Section 3: AI Recommendation Centerpiece */}
                      {activeDetailTicket.action_taken && (
                        <div className="bg-gradient-to-br from-brand-primary/[0.08] to-brand-primary/[0.02] border border-brand-primary/25 rounded-lg p-5 relative overflow-hidden space-y-4">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-primary to-indigo-500" />
                          
                          <div className="flex items-center justify-between">
                            <h3 className="text-[12px] font-bold text-brand-text-primary uppercase tracking-wider flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-brand-primary" />
                              AI Recommendation
                            </h3>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                              Auto Triage
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <h4 className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider mb-1">Recommended Action</h4>
                              <p className="text-[13px] text-brand-text-primary leading-relaxed whitespace-pre-wrap font-medium">
                                {activeDetailTicket.action_taken}
                              </p>
                            </div>
                            {activeDetailTicket.summary && activeDetailTicket.summary !== "Queued" && (
                              <div className="pt-3 border-t border-brand-border/60">
                                <h4 className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider mb-1">Ticket Summary</h4>
                                <p className="text-[13px] text-brand-text-secondary leading-relaxed">
                                  {activeDetailTicket.summary}
                                </p>
                              </div>
                            )}
                            {activeDetailTicket.resolution_note && (
                              <div className="pt-3 border-t border-brand-border/60">
                                <h4 className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider mb-1">Resolution Note</h4>
                                <p className="text-[13px] text-brand-text-secondary leading-relaxed">
                                  {activeDetailTicket.resolution_note}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Section 4: Actions */}
                      <div className="space-y-3">
                        <h3 className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">Actions</h3>
                        
                        {/* Quick Action Buttons */}
                        <div className="flex gap-2">
                          {activeDetailTicket.status !== "Resolved" && (
                            <button
                              onClick={() => handleResolve(activeDetailTicket.id)}
                              className="flex-1 py-2 px-3 bg-brand-success/10 hover:bg-brand-success/20 border border-brand-success/30 hover:border-brand-success/40 text-brand-success text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Resolve Ticket
                            </button>
                          )}
                          {activeDetailTicket.urgency !== "Critical" && (
                            <button
                              onClick={() => handleEscalate(activeDetailTicket.id)}
                              className="flex-1 py-2 px-3 bg-brand-danger/10 hover:bg-brand-danger/20 border border-brand-danger/30 hover:border-brand-danger/40 text-brand-danger text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              Escalate
                            </button>
                          )}
                        </div>

                        {/* Dropdowns & Override row */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">Change Status</label>
                            <select
                              value={activeDetailTicket.status || "Open"}
                              onChange={(e) => updateStatus(activeDetailTicket.id, e.target.value)}
                              className="bg-brand-surface border border-brand-border hover:border-brand-border-strong rounded-lg px-3 py-2 text-[12px] text-brand-text-primary focus:outline-none transition-colors"
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">Assign Agent</label>
                            <select
                              value={activeDetailTicket.assigned_to || ""}
                              onChange={(e) => assignTicket(activeDetailTicket.id, e.target.value)}
                              className="bg-brand-surface border border-brand-border hover:border-brand-border-strong rounded-lg px-3 py-2 text-[12px] text-brand-text-primary focus:outline-none transition-colors"
                            >
                              <option value="">Unassigned</option>
                              <option value="admin@gmail.com">admin@gmail.com</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1.5">
                          <button
                            onClick={() => openOverrideModal(activeDetailTicket)}
                            className="flex-1 py-1.5 px-3 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary text-[12px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            Manual Override
                          </button>
                          <button
                            onClick={() => deleteTicket(activeDetailTicket.id)}
                            className="py-1.5 px-3 border border-transparent hover:border-brand-danger/30 hover:bg-brand-danger/5 text-brand-text-muted hover:text-brand-danger text-[12px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Section 5: Activity & Discussion Timeline */}
                      <div className="space-y-4 pt-2">
                        <h3 className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Activity & Discussion
                        </h3>
                        
                        <div className="relative border-l border-brand-border ml-3.5 pl-6 space-y-6">
                          {getTimelineEvents(activeDetailTicket, comments).map((ev, idx) => (
                            <div key={idx} className="relative">
                              {/* Dot icon */}
                              <span className="absolute -left-[36px] top-0 bg-brand-surface border border-brand-border rounded-full p-1.5 w-7 h-7 flex items-center justify-center shadow-sm">
                                <ev.icon className={`w-3.5 h-3.5 ${ev.iconColor}`} />
                              </span>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12px] font-semibold text-brand-text-primary">{ev.title}</span>
                                  <span className="text-[10px] text-brand-text-muted font-medium whitespace-nowrap" title={formatDate(ev.time)}>
                                    {timeAgo(ev.time)}
                                  </span>
                                </div>
                                <p className="text-[12px] text-brand-text-secondary leading-relaxed whitespace-pre-wrap font-normal select-text">
                                  {ev.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Composer */}
                  <div className="px-6 py-4 border-t border-brand-border shrink-0 bg-brand-surface">
                    <AnimatePresence>
                      {aiReply && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-2"
                        >
                          <div className="p-2.5 bg-brand-primary/5 border border-brand-primary/10 rounded text-[12px] text-brand-text-secondary">
                            <p className="whitespace-pre-wrap mb-1.5 font-medium">{aiReply}</p>
                            <button onClick={() => setNewComment(aiReply)} className="text-[11px] font-semibold text-brand-primary hover:underline">
                              Use suggestion
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => generateAiReply(activeDetailTicket.id)}
                        className="shrink-0 p-2 text-brand-text-muted hover:text-brand-primary hover:bg-brand-elevated rounded-lg transition-colors"
                        title="AI suggestion"
                      >
                        <BrainCircuit className="w-4 h-4" />
                      </button>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Type a message... (Press Enter to send)"
                        rows={1}
                        className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none min-h-[36px] max-h-[100px]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminComment(); }
                        }}
                      />
                      <button
                        onClick={sendAdminComment}
                        disabled={!newComment.trim()}
                        className="shrink-0 p-2 bg-brand-primary text-white rounded-lg disabled:opacity-30 transition-colors hover:bg-brand-primary/90 flex items-center justify-center"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS VIEW ═══ */}
      {activeView === "analytics" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total", val: analytics.total_tickets },
                  { label: "High Priority", val: analytics.high_priority_tickets, color: "text-brand-danger" },
                  { label: "Status", val: analytics.system_status, color: "text-brand-success" },
                  { label: "Assigned", val: assignedTickets },
                  { label: "Unassigned", val: unassignedTickets, color: "text-brand-warning" },
                ].map((c, i) => (
                  <div key={i} className="bg-brand-surface border border-brand-border rounded-md p-3.5">
                    <div className="text-[11px] text-brand-text-muted uppercase tracking-wide mb-1.5">{c.label}</div>
                    <div className={`text-lg font-semibold ${c.color || "text-brand-text-primary"}`}>{c.val}</div>
                  </div>
                ))}
              </div>
            )}
            {operationsAnalytics && (
              <div className="bg-brand-surface border border-brand-border rounded-md p-4">
                <h2 className="text-[12px] font-semibold text-brand-text-primary mb-3 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-brand-text-muted" />
                  Performance
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Avg Resolution", val: `${operationsAnalytics.avg_resolution_hours}h` },
                    { label: "Top Department", val: operationsAnalytics.top_department },
                    { label: "Common Priority", val: operationsAnalytics.most_common_urgency },
                    { label: "Resolved Today", val: operationsAnalytics.resolved_today },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="text-[10px] text-brand-text-muted uppercase tracking-wide mb-0.5">{s.label}</div>
                      <div className="text-[13px] font-semibold text-brand-text-primary">{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-brand-surface border border-brand-border rounded-md p-4 h-[280px] flex flex-col">
                <h3 className="text-[12px] font-semibold text-brand-text-primary mb-3">Priority Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {priorityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "4px", fontSize: "11px", color: "#fafafa" }} itemStyle={{ color: "#fafafa" }} />
                      <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: "10px", color: "#a1a1aa" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-brand-surface border border-brand-border rounded-md p-4 h-[280px] flex flex-col">
                <h3 className="text-[12px] font-semibold text-brand-text-primary mb-3">Volume by Priority</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#27272a", opacity: 0.4 }} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "4px", fontSize: "11px", color: "#fafafa" }} />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {priorityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-border rounded-md">
              <div className="px-4 py-2.5 border-b border-brand-border flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-brand-text-muted" />
                <h3 className="text-[12px] font-semibold text-brand-text-primary">Activity</h3>
              </div>
              <div className="p-1.5 max-h-[240px] overflow-y-auto">
                {activityFeed.length === 0 ? (
                  <div className="text-[12px] text-brand-text-muted text-center py-6">No recent activity.</div>
                ) : (
                  activityFeed.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-brand-bg text-[11px] transition-colors">
                      <span className="text-brand-text-muted font-mono shrink-0">{item.time}</span>
                      <span className="text-brand-primary font-medium uppercase shrink-0">{item.event}</span>
                      <span className="text-brand-text-muted">#{item.ticketId}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ KNOWLEDGE VIEW ═══ */}
      {activeView === "knowledge" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
            <div>
              <h1 className="text-[16px] font-semibold text-brand-text-primary mb-0.5">Knowledge Base</h1>
              <p className="text-[12px] text-brand-text-muted">Articles the AI references when triaging tickets.</p>
            </div>
            <div className="bg-brand-surface border border-brand-border rounded-md p-4 space-y-3">
              <input
                type="text"
                placeholder="Article title"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-brand-bg border border-brand-border rounded text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong"
              />
              <textarea
                placeholder="Article content..."
                value={knowledgeContent}
                onChange={(e) => setKnowledgeContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-1.5 bg-brand-bg border border-brand-border rounded text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
              />
              <button
                onClick={addKnowledge}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-[12px] font-medium rounded hover:bg-brand-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Article
              </button>
            </div>
            {knowledge.length === 0 ? (
              <div className="text-center py-10">
                <BookOpen className="w-6 h-6 text-brand-text-muted mx-auto mb-2" />
                <p className="text-[12px] text-brand-text-muted">No articles yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {knowledge.map((item) => (
                  <div key={item.id} className="bg-brand-surface border border-brand-border rounded-md px-4 py-3 group hover:border-brand-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-[12px] font-medium text-brand-text-primary">{item.title}</h4>
                        <p className="text-[11px] text-brand-text-muted mt-0.5 line-clamp-1">{item.content}</p>
                      </div>
                      <button
                        onClick={() => deleteKnowledge(item.id)}
                        className="p-1 text-brand-text-muted hover:text-brand-danger rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ OVERRIDE MODAL ═══ */}
      <AnimatePresence>
        {showOverrideModal && selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => { setShowOverrideModal(false); setSelectedTicket(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="relative w-full max-w-md bg-brand-surface border border-brand-border rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-brand-border flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-brand-text-primary">Override Action</h2>
                <button onClick={() => { setShowOverrideModal(false); setSelectedTicket(null); }} className="text-brand-text-muted hover:text-brand-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-[11px] text-brand-text-muted uppercase tracking-wide mb-1">Ticket</div>
                  <div className="text-[13px] text-brand-text-primary">{selectedTicket.subject}</div>
                </div>
                <div>
                  <div className="text-[11px] text-brand-text-muted uppercase tracking-wide mb-1">Current AI Action</div>
                  <div className="text-[12px] text-brand-text-secondary bg-brand-bg p-2.5 rounded border border-brand-border">{selectedTicket.action_taken || "Pending"}</div>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-brand-text-primary block mb-1">Override Reason</label>
                  <textarea
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    placeholder="Explain the manual override..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded px-3 py-2 text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-brand-text-primary block mb-1">Resolution Note</label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Note for the customer..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded px-3 py-2 text-[12px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-brand-border flex justify-end gap-2">
                <button
                  onClick={() => { updateResolutionNote(selectedTicket.id, resolutionNote); setShowOverrideModal(false); setSelectedTicket(null); }}
                  className="px-3 py-1.5 bg-brand-surface border border-brand-border rounded text-[12px] font-medium text-brand-text-primary hover:bg-brand-elevated transition-colors"
                >
                  Save Note
                </button>
                <button
                  onClick={handleApplyOverride}
                  disabled={isSubmitting || !overrideText.trim()}
                  className="px-3 py-1.5 bg-brand-primary text-white rounded text-[12px] font-medium disabled:opacity-40 hover:bg-brand-primary/90 transition-colors"
                >
                  {isSubmitting ? "Applying..." : "Apply Override"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ PAYWALL MODAL ═══ */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.97 }}
              className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-lg p-5 relative"
            >
              <button onClick={() => setShowPaywall(false)} className="absolute top-3 right-3 text-brand-text-muted hover:text-brand-text-primary">
                <X className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">Upgrade Required</span>
              <h2 className="text-[15px] font-semibold mt-1.5 mb-1 text-brand-text-primary">Unlock full access</h2>
              <p className="text-[12px] text-brand-text-muted mb-4">Your workspace has reached the free tier limit.</p>
              <button
                onClick={() => handleTriggerCheckout("Growth")}
                disabled={checkoutLoading}
                className="w-full py-2 bg-brand-primary text-white text-[12px] font-medium rounded flex justify-center items-center gap-2 hover:bg-brand-primary/90 transition-colors"
              >
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upgrade Workspace"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

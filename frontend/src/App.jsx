import { useEffect, useState } from "react";
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
  MessageSquare,
  X,
  User,
  Inbox,
  Clock,
  Circle,
  Hash,
  ChevronDown,
  MoreHorizontal,
  ArrowUpRight,
  Calendar,
  Mail,
  Building2,
  Tag,
  Activity,
  TrendingUp,
  Plus,
  RefreshCw,
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

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
  Open:          { color: "#f97316", bg: "rgba(249,115,22,0.1)",  label: "Open" },
  "In Progress": { color: "#6366f1", bg: "rgba(99,102,241,0.1)",  label: "In Progress" },
  Resolved:      { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   label: "Resolved" },
  Closed:        { color: "#71717a", bg: "rgba(113,113,122,0.1)", label: "Closed" },
};

const PRIORITY_CONFIG = {
  Critical: { color: "#ef4444", dot: "#ef4444" },
  High:     { color: "#ef4444", dot: "#ef4444" },
  Medium:   { color: "#f59e0b", dot: "#f59e0b" },
  Low:      { color: "#22c55e", dot: "#22c55e" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const CHART_COLORS = ["#ef4444", "#f59e0b", "#22c55e"];

/* ═══════════════════════════════════════════════════════════════
   INLINE UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Open;
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none"
    >
      <span style={{ background: cfg.color }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      {cfg.label}
    </span>
  );
}

function PriorityIndicator({ priority, size = "sm" }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  const dim = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  return <span style={{ background: cfg.dot }} className={`${dim} rounded-full shrink-0`} />;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  return (
    <span style={{ color: cfg.color }} className="text-[11px] font-medium leading-none">
      {priority || "Medium"}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">
      {children}
    </h3>
  );
}

function MetaRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-3.5 h-3.5 text-brand-text-muted mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-brand-text-muted mb-0.5">{label}</div>
        <div className="text-[13px] text-brand-text-primary">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function App() {
  /* ── State ── */
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

  const [activeView, setActiveView] = useState("inbox");

  /* ── Effects ── */
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

  /* ── Business Logic ── */
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
      showNotification(`Status updated to ${newStatus}.`, "success");
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
      if (selectedCommentTicket?.id === ticketId) {
        setSelectedCommentTicket(null);
        setComments([]);
      }
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

  /* ── Derived State ── */
  const selectTicketForDetail = (ticket) => {
    setSelectedCommentTicket(ticket);
    loadComments(ticket.id);
    setAiReply("");
  };

  const activeDetailTicket = selectedCommentTicket
    ? tickets.find((t) => t.id === selectedCommentTicket.id) || selectedCommentTicket
    : null;

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

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <Loader2 className="w-5 h-5 text-brand-text-muted animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-brand-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center max-w-xs">
          <AlertCircle className="w-8 h-8 text-brand-text-muted mx-auto mb-4" />
          <h2 className="text-[15px] font-semibold text-brand-text-primary mb-2">Unable to connect</h2>
          <p className="text-[13px] text-brand-text-secondary mb-5">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-surface border border-brand-border rounded-md text-[13px] font-medium text-brand-text-primary hover:bg-brand-elevated transition-colors"
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

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col bg-brand-bg text-brand-text-primary overflow-hidden">

      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full px-4"
          >
            <div className={`px-4 py-2.5 rounded-lg border flex items-center gap-2.5 text-[13px] font-medium shadow-lg ${
              notification.type === "success"
                ? "bg-brand-surface border-brand-success/20 text-brand-success"
                : "bg-brand-surface border-brand-danger/20 text-brand-danger"
            }`}>
              {notification.type === "success"
                ? <CheckCircle className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="truncate">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="h-12 border-b border-brand-border bg-brand-bg flex items-center justify-between px-4 shrink-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-brand-primary flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 5h12M2 8h9M2 11h6" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold tracking-tight">HelpdeskAI</span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  activeView === item.key
                    ? "bg-brand-surface text-brand-text-primary"
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
          className="flex items-center gap-1.5 text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      {/* ── Inbox View ── */}
      {activeView === "inbox" && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left Panel: Ticket List ── */}
          <aside className="w-[380px] border-r border-brand-border flex flex-col bg-brand-bg shrink-0">

            {/* Toolbar */}
            <div className="px-3 py-3 border-b border-brand-border space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-brand-surface border border-brand-border rounded-md text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-brand-surface border border-brand-border rounded-md p-0.5 flex-1">
                  {[
                    { key: "all", label: "All" },
                    { key: "mine", label: "Mine" },
                    { key: "unassigned", label: "Unassigned" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTicketFilter(tab.key)}
                      className={`flex-1 px-2 py-1 rounded text-[12px] font-medium transition-colors ${
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
                  className="bg-brand-surface border border-brand-border rounded-md px-2 py-1 text-[12px] text-brand-text-secondary focus:outline-none"
                >
                  <option value="All">Priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Ticket rows */}
            <div className="flex-1 overflow-y-auto">
              {allDisplayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Inbox className="w-8 h-8 text-brand-text-muted mb-3" />
                  <p className="text-[13px] text-brand-text-muted">No tickets found</p>
                  <p className="text-[12px] text-brand-text-muted mt-1">Adjust your filters or wait for incoming tickets.</p>
                </div>
              ) : (
                allDisplayed.map((ticket) => {
                  const isActive = activeDetailTicket?.id === ticket.id;
                  const isResolved = RESOLVED_STATUSES.includes(ticket.status);
                  const unread = getUnreadCount(ticket);
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => selectTicketForDetail(ticket)}
                      className={`px-3 py-3 border-b border-brand-border cursor-pointer transition-colors ${
                        isActive
                          ? "bg-brand-surface"
                          : "hover:bg-brand-surface/50"
                      } ${isResolved ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <PriorityIndicator priority={ticket.urgency} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[13px] font-medium truncate ${isResolved ? "line-through text-brand-text-secondary" : "text-brand-text-primary"}`}>
                              {ticket.subject}
                            </span>
                            <span className="text-[11px] text-brand-text-muted shrink-0">
                              {timeAgo(ticket.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] text-brand-text-muted truncate">
                              {ticket.sender}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {unread > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                              )}
                              <StatusBadge status={ticket.status} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* List footer */}
            <div className="px-3 py-2 border-t border-brand-border text-[11px] text-brand-text-muted shrink-0">
              {allDisplayed.length} ticket{allDisplayed.length !== 1 ? "s" : ""}
            </div>
          </aside>

          {/* ── Right Panel: Ticket Detail ── */}
          <main className="flex-1 flex flex-col overflow-hidden bg-brand-bg">
            {activeDetailTicket ? (
              <>
                {/* Detail Header */}
                <div className="px-6 py-4 border-b border-brand-border shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[16px] font-semibold text-brand-text-primary leading-snug mb-2">
                        {activeDetailTicket.subject}
                      </h2>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[12px] text-brand-text-muted flex items-center gap-1">
                          <Hash className="w-3 h-3" />{activeDetailTicket.id}
                        </span>
                        <StatusBadge status={activeDetailTicket.status} />
                        <span className="flex items-center gap-1.5">
                          <PriorityIndicator priority={activeDetailTicket.urgency} />
                          <PriorityBadge priority={activeDetailTicket.urgency} />
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={activeDetailTicket.status || "Open"}
                        onChange={(e) => updateStatus(activeDetailTicket.id, e.target.value)}
                        className="bg-brand-surface border border-brand-border rounded-md px-2.5 py-1.5 text-[12px] text-brand-text-primary focus:outline-none"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                      <select
                        value={activeDetailTicket.assigned_to || ""}
                        onChange={(e) => assignTicket(activeDetailTicket.id, e.target.value)}
                        className="bg-brand-surface border border-brand-border rounded-md px-2.5 py-1.5 text-[12px] text-brand-text-primary focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        <option value="admin@gmail.com">admin@gmail.com</option>
                      </select>
                      <button
                        onClick={() => openOverrideModal(activeDetailTicket)}
                        className="px-2.5 py-1.5 bg-brand-surface border border-brand-border rounded-md text-[12px] font-medium text-brand-text-primary hover:bg-brand-elevated transition-colors"
                      >
                        Override
                      </button>
                      <button
                        onClick={() => deleteTicket(activeDetailTicket.id)}
                        className="p-1.5 text-brand-text-muted hover:text-brand-danger rounded-md hover:bg-brand-surface transition-colors"
                        title="Delete ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-6 py-5 space-y-6 max-w-3xl">

                    {/* Metadata */}
                    <section>
                      <SectionLabel>Details</SectionLabel>
                      <div className="grid grid-cols-2 gap-x-6 border border-brand-border rounded-lg p-4 bg-brand-surface">
                        <MetaRow icon={Mail} label="Customer">{activeDetailTicket.sender}</MetaRow>
                        <MetaRow icon={Building2} label="Department">{activeDetailTicket.department || "—"}</MetaRow>
                        <MetaRow icon={User} label="Assignee">{activeDetailTicket.assigned_to || "Unassigned"}</MetaRow>
                        <MetaRow icon={Calendar} label="Created">{formatDate(activeDetailTicket.created_at)}</MetaRow>
                        <MetaRow icon={Tag} label="Sentiment">{activeDetailTicket.sentiment || "—"}</MetaRow>
                        <MetaRow icon={Activity} label="Pipeline Stage">{activeDetailTicket.workflow_stage || "Queued"}</MetaRow>
                      </div>
                    </section>

                    {/* Description */}
                    <section>
                      <SectionLabel>Customer Message</SectionLabel>
                      <div className="text-[13px] text-brand-text-secondary leading-relaxed whitespace-pre-wrap bg-brand-surface border border-brand-border rounded-lg p-4">
                        {activeDetailTicket.description || "No description provided."}
                      </div>
                    </section>

                    {/* AI Analysis */}
                    {activeDetailTicket.action_taken && (
                      <section>
                        <SectionLabel>AI Analysis</SectionLabel>
                        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-md bg-brand-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1.5">Recommended Action</div>
                              <div className="text-[13px] text-brand-text-secondary leading-relaxed whitespace-pre-wrap">
                                {activeDetailTicket.action_taken}
                              </div>
                            </div>
                          </div>
                          {activeDetailTicket.summary && activeDetailTicket.summary !== "Queued" && (
                            <div className="mt-4 pt-4 border-t border-brand-border">
                              <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1.5">Summary</div>
                              <div className="text-[13px] text-brand-text-secondary leading-relaxed">
                                {activeDetailTicket.summary}
                              </div>
                            </div>
                          )}
                          {activeDetailTicket.resolution_note && (
                            <div className="mt-4 pt-4 border-t border-brand-border">
                              <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1.5">Resolution Note</div>
                              <div className="text-[13px] text-brand-text-secondary leading-relaxed">
                                {activeDetailTicket.resolution_note}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Discussion Thread */}
                    <section>
                      <SectionLabel>
                        Discussion {comments.length > 0 && `(${comments.length})`}
                      </SectionLabel>
                      <div className="space-y-4">
                        {comments.length === 0 ? (
                          <div className="text-[13px] text-brand-text-muted py-6 text-center bg-brand-surface border border-brand-border rounded-lg">
                            No messages yet. Start the conversation below.
                          </div>
                        ) : (
                          comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                comment.sender === "admin@gmail.com"
                                  ? "bg-brand-primary/10"
                                  : "bg-brand-surface border border-brand-border"
                              }`}>
                                {comment.sender === "admin@gmail.com"
                                  ? <User className="w-3.5 h-3.5 text-brand-primary" />
                                  : <User className="w-3.5 h-3.5 text-brand-text-muted" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[13px] font-medium text-brand-text-primary">{comment.sender}</span>
                                  <span className="text-[11px] text-brand-text-muted">
                                    {comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                  </span>
                                </div>
                                <div className="text-[13px] text-brand-text-secondary leading-relaxed">
                                  {comment.message}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                {/* Comment Composer */}
                <div className="px-6 py-3 border-t border-brand-border shrink-0 bg-brand-surface">
                  <AnimatePresence>
                    {aiReply && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-3"
                      >
                        <div className="p-3 bg-brand-primary/5 border border-brand-primary/15 rounded-lg">
                          <div className="text-[12px] text-brand-text-secondary mb-2 whitespace-pre-wrap">{aiReply}</div>
                          <button
                            onClick={() => setNewComment(aiReply)}
                            className="text-[12px] font-medium text-brand-primary hover:underline"
                          >
                            Use this suggestion
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => generateAiReply(activeDetailTicket.id)}
                      className="shrink-0 p-2 text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                      title="Generate AI reply suggestion"
                    >
                      <BrainCircuit className="w-4 h-4" />
                    </button>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a reply..."
                      rows={1}
                      className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none min-h-[40px] max-h-[120px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendAdminComment();
                        }
                      }}
                    />
                    <button
                      onClick={sendAdminComment}
                      disabled={!newComment.trim()}
                      className="shrink-0 p-2 bg-brand-primary text-white rounded-lg disabled:opacity-30 transition-colors hover:bg-brand-primary/90"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty Detail State */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center mb-4">
                  <Inbox className="w-5 h-5 text-brand-text-muted" />
                </div>
                <h3 className="text-[15px] font-semibold text-brand-text-primary mb-1">Select a ticket</h3>
                <p className="text-[13px] text-brand-text-muted max-w-xs">
                  Choose a ticket from the list to view its details, AI analysis, and discussion thread.
                </p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── Analytics View ── */}
      {activeView === "analytics" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {/* KPI Cards */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total Tickets", val: analytics.total_tickets },
                  { label: "High Priority", val: analytics.high_priority_tickets, color: "text-brand-danger" },
                  { label: "System Status", val: analytics.system_status, color: "text-brand-success" },
                  { label: "Assigned", val: assignedTickets },
                  { label: "Unassigned", val: unassignedTickets, color: "text-brand-warning" },
                ].map((card, i) => (
                  <div key={i} className="bg-brand-surface border border-brand-border rounded-lg p-4">
                    <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-2">{card.label}</div>
                    <div className={`text-xl font-semibold ${card.color || "text-brand-text-primary"}`}>{card.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Operations Metrics */}
            {operationsAnalytics && (
              <div className="bg-brand-surface border border-brand-border rounded-lg p-5">
                <h2 className="text-[13px] font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-text-muted" />
                  Performance Overview
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {[
                    { label: "Avg Resolution", val: `${operationsAnalytics.avg_resolution_hours}h` },
                    { label: "Top Department", val: operationsAnalytics.top_department },
                    { label: "Common Priority", val: operationsAnalytics.most_common_urgency },
                    { label: "Resolved Today", val: operationsAnalytics.resolved_today },
                  ].map((stat, i) => (
                    <div key={i}>
                      <div className="text-[11px] text-brand-text-muted uppercase tracking-wide mb-1">{stat.label}</div>
                      <div className="text-[14px] font-semibold text-brand-text-primary">{stat.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border rounded-lg p-5 h-[300px] flex flex-col">
                <h3 className="text-[13px] font-semibold text-brand-text-primary mb-4">Priority Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                        {priorityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "6px", fontSize: "12px", color: "#fafafa" }} itemStyle={{ color: "#fafafa" }} />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-brand-surface border border-brand-border rounded-lg p-5 h-[300px] flex flex-col">
                <h3 className="text-[13px] font-semibold text-brand-text-primary mb-4">Volume by Priority</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={11} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#27272a", opacity: 0.4 }} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "6px", fontSize: "12px", color: "#fafafa" }} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {priorityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-brand-surface border border-brand-border rounded-lg">
              <div className="px-5 py-3 border-b border-brand-border flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-text-muted" />
                <h3 className="text-[13px] font-semibold text-brand-text-primary">Recent Activity</h3>
              </div>
              <div className="p-2 max-h-[280px] overflow-y-auto">
                {activityFeed.length === 0 ? (
                  <div className="text-[13px] text-brand-text-muted text-center py-8">No recent activity.</div>
                ) : (
                  activityFeed.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-brand-bg text-[12px] transition-colors">
                      <span className="text-brand-text-muted font-mono shrink-0">{item.time}</span>
                      <span className="text-brand-primary font-medium uppercase text-[11px] shrink-0">{item.event}</span>
                      <span className="text-brand-text-muted">Ticket #{item.ticketId}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Knowledge View ── */}
      {activeView === "knowledge" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
            <div>
              <h1 className="text-[18px] font-semibold text-brand-text-primary mb-1">Knowledge Base</h1>
              <p className="text-[13px] text-brand-text-muted">
                Add articles that the AI uses as context when triaging tickets.
              </p>
            </div>

            {/* Add Article Form */}
            <div className="bg-brand-surface border border-brand-border rounded-lg p-5 space-y-3">
              <input
                type="text"
                placeholder="Article title"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong"
              />
              <textarea
                placeholder="Article content..."
                value={knowledgeContent}
                onChange={(e) => setKnowledgeContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
              />
              <button
                onClick={addKnowledge}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-[13px] font-medium rounded-md hover:bg-brand-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Article
              </button>
            </div>

            {/* Articles List */}
            {knowledge.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-8 h-8 text-brand-text-muted mx-auto mb-3" />
                <p className="text-[13px] text-brand-text-muted">No articles yet. Add your first article above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {knowledge.map((item) => (
                  <div key={item.id} className="bg-brand-surface border border-brand-border rounded-lg p-4 group hover:border-brand-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-medium text-brand-text-primary mb-1">{item.title}</h4>
                        <p className="text-[12px] text-brand-text-muted line-clamp-2">{item.content}</p>
                      </div>
                      <button
                        onClick={() => deleteKnowledge(item.id)}
                        className="p-1.5 text-brand-text-muted hover:text-brand-danger rounded-md opacity-0 group-hover:opacity-100 transition-all"
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

      {/* ── Override Modal ── */}
      <AnimatePresence>
        {selectedTicket && !selectedCommentTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
              onClick={() => setSelectedTicket(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-brand-text-primary">Override Action</h2>
                <button onClick={() => setSelectedTicket(null)} className="text-brand-text-muted hover:text-brand-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1">Ticket</div>
                  <div className="text-[13px] text-brand-text-primary">{selectedTicket.subject}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1">Current AI Action</div>
                  <div className="text-[12px] text-brand-text-secondary bg-brand-bg p-3 rounded-md border border-brand-border">
                    {selectedTicket.action_taken || "Pending"}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-brand-text-primary block mb-1.5">Override Reason</label>
                  <textarea
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    placeholder="Explain the manual override..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-brand-text-primary block mb-1.5">Resolution Note</label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Note for the customer..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-brand-border flex justify-end gap-2">
                <button
                  onClick={() => { updateResolutionNote(selectedTicket.id, resolutionNote); setSelectedTicket(null); }}
                  className="px-4 py-2 bg-brand-surface border border-brand-border rounded-md text-[13px] font-medium text-brand-text-primary hover:bg-brand-elevated transition-colors"
                >
                  Save Note Only
                </button>
                <button
                  onClick={handleApplyOverride}
                  disabled={isSubmitting || !overrideText.trim()}
                  className="px-4 py-2 bg-brand-primary text-white rounded-md text-[13px] font-medium disabled:opacity-40 hover:bg-brand-primary/90 transition-colors"
                >
                  {isSubmitting ? "Applying..." : "Apply Override"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Override modal for when detail panel is also open */}
      <AnimatePresence>
        {selectedTicket && selectedCommentTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
              onClick={() => setSelectedTicket(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-brand-text-primary">Override Action</h2>
                <button onClick={() => setSelectedTicket(null)} className="text-brand-text-muted hover:text-brand-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1">Ticket</div>
                  <div className="text-[13px] text-brand-text-primary">{selectedTicket.subject}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-brand-text-muted uppercase tracking-wide mb-1">Current AI Action</div>
                  <div className="text-[12px] text-brand-text-secondary bg-brand-bg p-3 rounded-md border border-brand-border">
                    {selectedTicket.action_taken || "Pending"}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-brand-text-primary block mb-1.5">Override Reason</label>
                  <textarea
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    placeholder="Explain the manual override..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-brand-text-primary block mb-1.5">Resolution Note</label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Note for the customer..."
                    rows={2}
                    className="w-full bg-brand-bg border border-brand-border rounded-md px-3 py-2 text-[13px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:border-brand-border-strong resize-none"
                  />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-brand-border flex justify-end gap-2">
                <button
                  onClick={() => { updateResolutionNote(selectedTicket.id, resolutionNote); setSelectedTicket(null); }}
                  className="px-4 py-2 bg-brand-surface border border-brand-border rounded-md text-[13px] font-medium text-brand-text-primary hover:bg-brand-elevated transition-colors"
                >
                  Save Note Only
                </button>
                <button
                  onClick={handleApplyOverride}
                  disabled={isSubmitting || !overrideText.trim()}
                  className="px-4 py-2 bg-brand-primary text-white rounded-md text-[13px] font-medium disabled:opacity-40 hover:bg-brand-primary/90 transition-colors"
                >
                  {isSubmitting ? "Applying..." : "Apply Override"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Paywall Modal ── */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.97 }}
              className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl p-6 relative"
            >
              <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-brand-text-muted hover:text-brand-text-primary">
                <X className="w-4 h-4" />
              </button>
              <div className="mb-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">Upgrade Required</span>
                <h2 className="text-[16px] font-semibold mt-2 text-brand-text-primary">Unlock full access</h2>
                <p className="text-[13px] text-brand-text-muted mt-1">Your workspace has reached the free tier limit.</p>
              </div>
              <button
                onClick={() => handleTriggerCheckout("Growth")}
                disabled={checkoutLoading}
                className="w-full py-2.5 bg-brand-primary text-white text-[13px] font-medium rounded-md flex justify-center items-center gap-2 hover:bg-brand-primary/90 transition-colors"
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

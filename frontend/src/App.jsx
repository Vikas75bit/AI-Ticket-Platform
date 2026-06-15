import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Search,
  Users,
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
  Clock,
  TrendingUp,
  Settings
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
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}/comments`
      );
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      const data = await response.json();
      const commentsArray = Array.isArray(data) ? data : [];
      setComments(commentsArray);

      // Update read mapping
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: "admin@gmail.com",
            message: newComment,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to post comment");
      }
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
      const response = await fetch(
        `${API_BASE_URL}/analytics/operations`
      );
      if (!response.ok) throw new Error("Failed to fetch operations analytics");
      const data = await response.json();
      setOperationsAnalytics(data);
    } catch (error) {
      console.error(
        "Operations analytics failed:",
        error
      );
    }
  };

  const fetchTickets = () => {
    axios
      .get(`${API_BASE_URL}/tickets`)
      .then((response) => {
        setTickets(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error("Failed to query records stream:", err);
      });
  };

  const fetchKnowledge = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/knowledge`
      );
      const data = await response.json();
      setKnowledge(data || []);
    } catch (error) {
      console.error(
        "Knowledge fetch failed",
        error
      );
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
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          const activity = {
            time: new Date().toLocaleTimeString(),
            event: payload.eventType,
            ticketId: payload.new?.id || payload.old?.id,
          };

          setActivityFeed((current) => [
            activity,
            ...current.slice(0, 9)
          ]);

          fetchTickets();
          fetchAnalytics();
          fetchOperationsAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Open a native persistent streaming link directly to our FastAPI channel gateway
    const eventSource = new EventSource(`${API_BASE_URL}/api/v1/tickets/stream`);

    eventSource.onmessage = (event) => {
      try {
        const liveUpdate = JSON.parse(event.data);
        console.log("📡 LIVE BROADCAST PACKET CAUGHT:", liveUpdate);

        // Instantly scan state and map the changes onto the specific row without refreshing!
        setTickets((prevTickets) =>
          prevTickets.map((ticket) =>
            ticket.id === liveUpdate.ticket_id
              ? { ...ticket, urgency: liveUpdate.status, action_taken: liveUpdate.action_taken }
              : ticket
          )
        );

        // Keep the metrics fresh when updates broadcast down the wire
        fetchAnalytics();
        fetchOperationsAnalytics();
      } catch (err) {
        console.error("Error parsing live update packet:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Streaming connection error, retrying structural links...", err);
    };

    // Clean up the network connection if the component unmounts
    return () => {
      eventSource.close();
    };
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

  const handleTriggerCheckout = async (planName, priceAmount) => {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      showNotification("Ticket status updated successfully.", "success");
      fetchTickets();
    } catch (error) {
      showNotification(`Status update failed: ${error.message}`, "error");
    }
  };

  const updateResolutionNote = async (ticketId, note) => {
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        resolution_note: note,
      })
      .eq("id", ticketId);

    if (updateErr) {
      showNotification(`Saving resolution note failed: ${updateErr.message}`, "error");
      return;
    }

    fetchTickets();
    showNotification("Resolution note saved successfully!", "success");
  };

  const assignTicket = async (ticketId, assignedAgent) => {
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        assigned_to: assignedAgent,
      })
      .eq("id", ticketId);

    if (updateErr) {
      showNotification(`Assignment failed: ${updateErr.message}`, "error");
      return;
    }

    showNotification(
      assignedAgent ? `Ticket assigned to ${assignedAgent}` : "Ticket unassigned",
      "success"
    );
    fetchTickets();
  };

  const openOverrideModal = (ticket) => {
    setSelectedTicket(ticket);
    setOverrideText("");
    setResolutionNote(ticket.resolution_note || "");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredTickets = tickets.filter((ticket) => {
    const sender = String(ticket.sender || "");
    const subject = String(ticket.subject || "");
    const normalizedSearchTerm = searchTerm.toLowerCase();

    const matchesSearch =
      sender.toLowerCase().includes(normalizedSearchTerm) ||
      subject.toLowerCase().includes(normalizedSearchTerm);

    const matchesUrgency =
      urgencyFilter === "All" || ticket.urgency === urgencyFilter;

    return matchesSearch && matchesUrgency;
  });

  const displayedTickets = filteredTickets.filter((ticket) => {
    if (ticketFilter === "mine") {
      return ticket.assigned_to === "admin@gmail.com";
    }
    if (ticketFilter === "unassigned") {
      return !ticket.assigned_to;
    }
    return true;
  });

  const assignedTickets = tickets.filter((ticket) => ticket.assigned_to).length;
  const unassignedTickets = tickets.filter((ticket) => !ticket.assigned_to).length;

  const priorityData = [
    { name: "High", value: tickets.filter((ticket) => ticket.urgency === "High").length },
    { name: "Medium", value: tickets.filter((ticket) => ticket.urgency === "Medium").length },
    { name: "Low", value: tickets.filter((ticket) => ticket.urgency === "Low").length },
  ];

  const CHART_COLORS = ["#ef4444", "#f59e0b", "#10b981"]; // Danger, Warning, Success match

  const addKnowledge = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      showNotification("Please fill in both the title and content fields.", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: knowledgeTitle,
          content: knowledgeContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create knowledge article");
      }

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
    const confirmed = window.confirm(
      "Delete this knowledge article?"
    );
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/knowledge/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Delete failed"
        );
      }

      fetchKnowledge();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const generateAiReply = async (ticketId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}/suggest-reply`,
        {
          method: "POST",
        }
      );
      const data = await response.json();
      setAiReply(data.reply || "");
    } catch (error) {
      console.error("AI reply generation failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-4" />
          <div className="text-xs font-medium text-brand-text-secondary">Loading dashboard infrastructure...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-8">
        <div className="max-w-md w-full bg-brand-surface border border-brand-border/60 rounded-xl p-8 text-center shadow-2xl">
          <AlertCircle className="w-10 h-10 text-brand-danger mx-auto mb-4" />
          <h2 className="text-sm font-bold text-brand-text-primary mb-2">Failed to Load Dashboard</h2>
          <p className="text-xs text-brand-text-secondary mb-6 leading-normal">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs rounded-lg transition shadow-md cursor-pointer"
          >
            Retry Handshake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text-primary pb-16 selection:bg-brand-primary/30 selection:text-white relative overflow-x-hidden">
      {/* Sleek top glow gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[300px] bg-gradient-to-b from-brand-primary/5 to-transparent blur-[120px] rounded-full pointer-events-none"></div>

      {/* Global Toast Notifications */}
      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 max-w-md w-full px-4"
          >
            <div
              className={`p-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 ${notification.type === "success"
                  ? "bg-brand-surface border-brand-success/30 text-brand-success"
                  : "bg-brand-surface border-brand-danger/30 text-brand-danger"
                }`}
            >
              {notification.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <p className="flex-1 text-xs font-medium leading-normal">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <nav className="border-b bg-brand-surface/40 border-brand-border/40 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary text-xs font-black">
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold tracking-tight text-sm text-brand-text-primary">
                AI Operations Dashboard
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 bg-brand-elevated/20 text-brand-text-secondary rounded-full border border-brand-border/40 text-[10px] font-semibold uppercase tracking-wider">
                <Activity className="w-3 h-3 text-brand-success" />
                Staff Admin mode
              </span>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="px-3 py-1.5 bg-brand-elevated/40 hover:bg-brand-elevated text-brand-text-primary hover:text-white border border-brand-border/60 hover:border-brand-border text-[11px] font-semibold rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3 h-3 text-brand-text-secondary" />
                Logout
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {analytics && (
          <div className="space-y-8">

            {/* Executive Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {[
                { label: "Total Tickets", val: analytics.total_tickets, desc: "Cumulative volume", color: "text-brand-text-primary" },
                { label: "High Priority", val: analytics.high_priority_tickets, desc: "Critical escalations", color: "text-brand-danger" },
                { label: "Triage Engine", val: analytics.system_status, desc: "AI Gateway classification", color: "text-brand-success" },
                { label: "Assigned Staff", val: assignedTickets, desc: "In-progress ownership", color: "text-brand-primary" },
                { label: "Unassigned Queue", val: unassignedTickets, desc: "Awaiting intervention", color: "text-brand-warning" }
              ].map((card, idx) => (
                <div key={idx} className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-sm">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary mb-1">
                    {card.label}
                  </h2>
                  <p className={`text-2xl font-bold tracking-tight ${card.color}`}>{card.val}</p>
                  <span className="text-[9px] text-brand-text-secondary/50 mt-1 block">{card.desc}</span>
                </div>
              ))}
            </div>

            {/* Operations Metrics */}
            {operationsAnalytics && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  Performance Analytics Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {[
                    { label: "Avg Resolution Time", val: `${operationsAnalytics.avg_resolution_hours} Hours`, color: "text-indigo-400" },
                    { label: "Top Department", val: operationsAnalytics.top_department, color: "text-purple-400" },
                    { label: "Most Common Urgency", val: operationsAnalytics.most_common_urgency, color: "text-brand-warning" },
                    { label: "Resolved Today", val: operationsAnalytics.resolved_today, color: "text-brand-success" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-brand-surface/70 border border-brand-border/40 rounded-xl p-5 shadow-xs">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary mb-1">
                        {stat.label}
                      </h3>
                      <p className={`text-lg font-bold truncate ${stat.color}`} title={stat.val}>
                        {stat.val}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Weekly Performance Banner */}
                <div className="bg-brand-surface/40 border border-brand-border/40 rounded-xl p-4 flex justify-between items-center text-xs">
                  <span className="text-brand-text-secondary font-medium">Weekly Performance metrics</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-brand-text-secondary">Resolved This Week:</span>
                    <span className="font-mono font-bold px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded">
                      {operationsAnalytics.resolved_this_week}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Console Logs Activity Stream */}
            {activityFeed.length > 0 && (
              <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-brand-success rounded-full animate-pulse"></span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-brand-text-primary">
                    Realtime Event Feed (SSE)
                  </h2>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {activityFeed.map((item, index) => (
                    <div
                      key={index}
                      className="py-2 px-3 bg-brand-bg border border-brand-border/40 rounded-lg text-[10px] font-mono flex items-center justify-between text-brand-text-secondary hover:border-brand-border transition duration-150"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-brand-text-secondary/40">[{item.time}]</span>
                        <span className="font-bold text-brand-primary uppercase">{item.event}</span>
                        <span>Ticket ID: #{item.ticketId}</span>
                      </div>
                      <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/25 px-1.5 py-0.5 rounded">
                        Streaming
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart Plots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-text-primary mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-brand-primary" />
                  Priority Weight Distribution
                </h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={70}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                          fontSize: "11px",
                          color: "#fafafa"
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-text-primary mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-brand-primary" />
                  Volume Load metrics
                </h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} />
                      <YAxis stroke="#a1a1aa" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                          fontSize: "11px",
                          color: "#fafafa"
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Ticket Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Knowledge Base */}
            <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-text-primary mb-4 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-brand-primary" />
                AI Knowledge Ingestion Manager
              </h2>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Knowledge Base Article Title"
                  value={knowledgeTitle}
                  onChange={(e) => setKnowledgeTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition placeholder:text-brand-text-secondary/35"
                />

                <textarea
                  placeholder="Knowledge content description context..."
                  value={knowledgeContent}
                  onChange={(e) => setKnowledgeContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition placeholder:text-brand-text-secondary/35 resize-none"
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={addKnowledge}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                >
                  Ingest Article context
                </motion.button>
              </div>

              <div className="mt-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text-secondary mb-3">
                  Ingested Knowledge Base Contexts ({knowledge.length})
                </h3>
                {knowledge.length === 0 ? (
                  <p className="text-xs text-brand-text-secondary/50 italic py-2">No contexts ingested yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {knowledge.map((item) => (
                      <div
                        key={item.id}
                        className="border border-brand-border/60 bg-brand-bg/40 p-4 rounded-xl flex justify-between items-start gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="font-semibold text-xs text-brand-primary">{item.title}</h4>
                          <p className="text-[11px] text-brand-text-secondary leading-normal">
                            {item.content}
                          </p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => deleteKnowledge(item.id)}
                          className="bg-brand-danger/10 border border-brand-danger/20 hover:bg-brand-danger hover:text-white text-brand-danger p-1.5 rounded transition cursor-pointer"
                          title="Purge context"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Ticket Stream Table */}
            <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-brand-border/40 pb-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary">
                    Active Ticket Queue Stream
                  </h2>
                  <p className="text-[11px] text-brand-text-secondary mt-0.5">
                    Realtime autonomous classification log stream
                  </p>
                </div>
                <div className="flex bg-brand-bg/50 border border-brand-border/40 p-1 rounded-lg gap-1">
                  {[
                    { key: "all", label: "All Queue" },
                    { key: "mine", label: "My Desk" },
                    { key: "unassigned", label: "Unallocated" }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTicketFilter(tab.key)}
                      className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 cursor-pointer ${ticketFilter === tab.key
                          ? "bg-brand-elevated text-brand-text-primary shadow-sm"
                          : "text-brand-text-secondary hover:text-brand-text-primary"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters Dock */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary/50" />
                  <input
                    type="text"
                    placeholder="Search query by sender or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition placeholder:text-brand-text-secondary/35"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-brand-text-secondary" />
                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg px-3 py-2 text-xs focus:outline-none text-brand-text-primary cursor-pointer transition font-medium"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              {/* High Density Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-border/40 text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary/70">
                      <th className="p-3">Sender</th>
                      <th className="p-3">Subject</th>
                      <th className="p-3">Attachment</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Classification</th>
                      <th className="p-3">Sentiment</th>
                      <th className="p-3">AI Action taken</th>
                      <th className="p-3">Resolution Note</th>
                      <th className="p-3">Ownership</th>
                      <th className="p-3">State</th>
                      <th className="p-3 text-center">Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="p-8 text-center text-brand-text-secondary/50 italic">
                          No active tickets fit the active filters.
                        </td>
                      </tr>
                    ) : (
                      displayedTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="border-b border-brand-border/30 hover:bg-brand-surface/30 transition duration-150"
                        >
                          <td className="p-3 font-semibold truncate max-w-[120px]" title={ticket.sender}>
                            {ticket.sender}
                          </td>
                          <td className="p-3 font-medium max-w-[150px] truncate" title={ticket.subject}>
                            <span className="flex items-center gap-1.5">
                              {ticket.subject}
                              {getUnreadCount(ticket) > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-brand-danger/10 text-brand-danger border border-brand-danger/20 rounded-full text-[8px] font-bold animate-pulse">
                                  {getUnreadCount(ticket)} new
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3">
                            {ticket.attachment_url ? (
                              <a
                                href={ticket.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                              >
                                View File
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-brand-text-secondary/40">None</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${ticket.urgency === "High"
                                ? "bg-brand-danger/10 text-brand-danger border border-brand-danger/20"
                                : ticket.urgency === "Medium"
                                  ? "bg-brand-warning/10 text-brand-warning border border-brand-warning/20"
                                  : "bg-brand-success/10 text-brand-success border border-brand-success/20"
                              }`}>
                              {ticket.urgency || "Low"}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-brand-primary">{ticket.department}</td>
                          <td className="p-3 italic text-brand-text-secondary">{ticket.sentiment || "Neutral"}</td>
                          <td className="p-3 max-w-[160px] truncate" title={ticket.action_taken}>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${ticket.action_taken?.includes("[MANUAL OVERRIDE]")
                                ? "bg-brand-warning/10 text-brand-warning border border-brand-warning/20"
                                : "bg-brand-elevated/40 text-brand-text-secondary border border-brand-border/40"
                              }`}>
                              {ticket.action_taken || "Awaiting triage..."}
                            </span>
                          </td>
                          <td className="p-3 max-w-[120px] truncate" title={ticket.resolution_note}>
                            <span className={`font-medium ${ticket.resolution_note ? "text-brand-success" : "text-brand-text-secondary/40"}`}>
                              {ticket.resolution_note || "None"}
                            </span>
                          </td>
                          <td className="p-3">
                            <select
                              value={ticket.assigned_to || ""}
                              onChange={(e) => assignTicket(ticket.id, e.target.value)}
                              className="bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded px-1.5 py-1 text-[10px] focus:outline-none text-brand-text-primary cursor-pointer transition font-medium"
                            >
                              <option value="">Unassigned</option>
                              <option value="admin@gmail.com">admin@gmail.com</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={ticket.status || "Open"}
                              onChange={(e) => updateStatus(ticket.id, e.target.value)}
                              className={`bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded px-1.5 py-1 text-[10px] focus:outline-none cursor-pointer transition font-bold ${ticket.status === "Resolved"
                                  ? "text-brand-success"
                                  : ticket.status === "In Progress"
                                    ? "text-brand-warning"
                                    : ticket.status === "Open"
                                      ? "text-brand-danger"
                                      : "text-brand-text-secondary"
                                }`}
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => openOverrideModal(ticket)}
                                className="px-2 py-1 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-[10px] rounded transition cursor-pointer shadow-xs"
                              >
                                Intervene
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSelectedCommentTicket(ticket);
                                  loadComments(ticket.id);
                                  setAiReply("");
                                }}
                                className="px-2 py-1 bg-brand-elevated/40 hover:bg-brand-elevated text-brand-text-primary border border-brand-border/60 hover:border-brand-border font-bold text-[10px] rounded transition cursor-pointer"
                              >
                                Discuss
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversation Logs Box */}
            <AnimatePresence>
              {selectedCommentTicket && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 shadow-xl mt-6 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-5 pb-4 border-b border-brand-border/40">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-brand-primary" />
                        Discuss Ticket #{selectedCommentTicket.id}
                      </h2>
                      <p className="text-[11px] text-brand-text-secondary mt-0.5">
                        Thread logs from customer <span className="font-semibold text-brand-text-primary">{selectedCommentTicket.sender}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCommentTicket(null);
                        setAiReply("");
                      }}
                      className="text-xs text-brand-text-secondary hover:text-brand-text-primary transition underline cursor-pointer font-semibold"
                    >
                      Close Discussion
                    </button>
                  </div>

                  <div className="space-y-3.5 mb-5 max-h-60 overflow-y-auto pr-1">
                    {(!Array.isArray(comments) || comments.length === 0) ? (
                      <div className="text-center py-6 text-brand-text-secondary/50 italic text-xs">
                        No messages have been posted on this support log yet.
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="border-b border-brand-border/30 pb-3 last:border-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-brand-text-secondary">
                              {comment.sender}
                            </span>
                            <span className="text-[9px] text-brand-text-secondary/40">
                              {comment.created_at ? new Date(comment.created_at).toLocaleTimeString() : ""}
                            </span>
                          </div>
                          <p className="text-xs leading-normal text-brand-text-primary">
                            {comment.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-brand-border/40 pt-4 space-y-4">
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generateAiReply(selectedCommentTicket.id)}
                        className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        Generate AI Response
                      </motion.button>
                    </div>

                    <AnimatePresence>
                      {aiReply && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="border border-brand-primary/20 bg-brand-primary/5 rounded-lg p-3 text-xs"
                        >
                          <h4 className="font-semibold text-brand-primary mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 animate-pulse" />
                            AI Suggested Reply
                          </h4>
                          <p className="whitespace-pre-wrap text-[11px] text-brand-text-secondary leading-normal mb-3">
                            {aiReply}
                          </p>
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setNewComment(aiReply)}
                            className="bg-brand-success hover:bg-brand-success/90 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Apply Suggestion
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Reply response details..."
                        rows={2}
                        className="flex-1 px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 resize-none placeholder:text-brand-text-secondary/35"
                      />
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={sendAdminComment}
                        className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-xs rounded-lg transition shadow-md cursor-pointer flex items-center justify-center shrink-0 self-end h-[38px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Human Intervention Overrides Modal Dialog */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="max-w-lg w-full bg-brand-surface border border-brand-border/60 rounded-xl shadow-2xl p-6 relative overflow-hidden"
            >
              <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-brand-warning" />
                Human Override Console
              </h2>
              <p className="text-[11px] text-brand-text-secondary mb-4 pb-3 border-b border-brand-border/40">
                Administrative control over ticket <span className="font-mono text-brand-primary font-bold">#{selectedTicket.id}</span>
              </p>

              <div className="space-y-4 mb-6 text-xs">
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1">Subject</label>
                  <div className="p-2.5 bg-brand-bg/50 border border-brand-border/40 rounded-lg text-brand-text-primary font-medium">
                    {selectedTicket.subject}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1">AI Action Taken</label>
                  <div className="p-2.5 bg-brand-bg/50 border border-brand-border/40 rounded-lg text-brand-text-secondary font-mono">
                    {selectedTicket.action_taken || "Awaiting triage action"}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1">Current Resolution</label>
                  <div className="p-2.5 bg-brand-success/5 border border-brand-success/10 rounded-lg text-brand-success font-medium">
                    {selectedTicket.resolution_note || "No resolution note recorded yet."}
                  </div>
                </div>
              </div>

              <form onSubmit={handleApplyOverride} className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1.5">Override Action Log Description</label>
                  <textarea
                    required
                    rows={2}
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    placeholder="e.g. Bypass standard triage: apply manual override to refund workflow."
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition resize-none placeholder:text-brand-text-secondary/35"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1.5">Customer-Facing Resolution Note</label>
                  <textarea
                    rows={2}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Write status update message details..."
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition resize-none placeholder:text-brand-text-secondary/35"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-brand-border/40 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="px-4 py-2 bg-brand-elevated/40 hover:bg-brand-elevated border border-brand-border/60 text-brand-text-secondary hover:text-brand-text-primary rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateResolutionNote(selectedTicket.id, resolutionNote);
                        setSelectedTicket(null);
                      }}
                      className="px-4 py-2 bg-brand-success hover:bg-brand-success/90 text-white font-semibold text-xs rounded-lg transition shadow-md cursor-pointer"
                    >
                      Save Resolution
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-lg transition duration-150 cursor-pointer"
                    >
                      {isSubmitting ? "Applying..." : "Apply Override"}
                    </motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paywall Upgrade Modal Dialog */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="max-w-2xl w-full bg-brand-surface border border-brand-border/60 rounded-2xl shadow-2xl p-8 relative overflow-hidden"
            >
              {/* Vercel-like top gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-primary to-purple-600"></div>

              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Tier Limit Exceeded
                </span>
                <h2 className="text-xl font-bold text-brand-text-primary mt-4 tracking-tight">
                  Upgrade Support Operations Plan
                </h2>
                <p className="text-xs text-brand-text-secondary mt-2 max-w-sm mx-auto leading-normal">
                  Your workspace has exhausted the default free tier classification allocations. Unlock priority queues.
                </p>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">

                {/* Starter Plan */}
                <div className="bg-brand-bg/40 border border-brand-border/40 rounded-xl p-5 flex flex-col justify-between opacity-50 relative">
                  <div>
                    <h3 className="text-xs font-bold text-brand-text-secondary uppercase tracking-wider">Starter Tier</h3>
                    <div className="mt-3 flex items-baseline gap-1 text-brand-text-primary">
                      <span className="text-2xl font-black">₹0</span>
                      <span className="text-[10px] text-brand-text-secondary">/ forever</span>
                    </div>
                    <ul className="mt-5 space-y-2 text-xs text-brand-text-secondary leading-normal">
                      <li className="flex items-center gap-2 text-brand-text-secondary/80">✕ Max 10 auto triages / mo</li>
                      <li className="flex items-center gap-2">✓ Basic sentiment classification</li>
                      <li className="flex items-center gap-2 text-brand-text-secondary/80">✕ Intervention logs panel</li>
                    </ul>
                  </div>
                  <button disabled className="w-full py-2 mt-6 bg-brand-elevated/40 text-brand-text-secondary/60 text-xs font-semibold rounded-lg cursor-not-allowed border border-brand-border/20">
                    Active Limit Exhausted
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-brand-bg border-2 border-brand-primary rounded-xl p-5 flex flex-col justify-between shadow-xl relative">
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-brand-primary text-white text-[9px] font-bold tracking-wide rounded-md uppercase">
                    Growth
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Operations Tier</h3>
                    <div className="mt-3 flex items-baseline gap-1 text-brand-text-primary">
                      <span className="text-3xl font-black">₹4,999</span>
                      <span className="text-[10px] text-brand-text-secondary">/ month</span>
                    </div>
                    <ul className="mt-5 space-y-2 text-xs text-brand-text-secondary leading-normal">
                      <li className="flex items-center gap-2 text-brand-text-primary">✓ <strong className="text-brand-primary">Unlimited</strong> Auto-Triaging</li>
                      <li className="flex items-center gap-2">✓ Priority classification queues</li>
                      <li className="flex items-center gap-2">✓ Human-in-the-loop overrides</li>
                    </ul>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTriggerCheckout("Growth Operations Tier", "₹4,999/mo")}
                    disabled={checkoutLoading}
                    className="w-full py-2 mt-6 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>
                        Upgrade Workspace
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </motion.button>
                </div>

              </div>

              {/* Close Button */}
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowPaywall(false)}
                  className="text-xs font-semibold text-brand-text-secondary hover:text-brand-text-primary transition underline cursor-pointer"
                >
                  Back to Dashboard (Read-Only)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

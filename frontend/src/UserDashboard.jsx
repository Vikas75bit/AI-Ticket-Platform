import { supabase } from "./supabase";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  RefreshCw,
  FileText,
  Send,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  User,
  Sparkles,
  Ticket,
  Search,
  ArrowRight,
  Loader2,
  Calendar,
  Layers,
  ChevronRight,
  Tag
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function UserDashboard() {
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [tickets, setTickets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [readComments, setReadComments] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    setReadComments(JSON.parse(localStorage.getItem("read_comments") || "{}"));
  }, []);

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const handleTriggerCheckout = async (planName, priceAmount) => {
    setCheckoutLoading(true);
    try {
      showNotification(`Redirecting to secure payment sandbox for ${planName}...`, "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      showNotification(`Upgrade processed successfully. Thank you for subscribing!`, "success");
      setShowPaywall(false);
    } catch (err) {
      showNotification(`Checkout Handshake Interrupted: ${err.message}`, "error");
    } finally {
      setCheckoutLoading(false);
    }
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
      console.error("Error loading comments:", error);
      setComments([]);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      await fetch(
        `${API_BASE_URL}/tickets/${selectedTicket.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: user.email,
            message: newComment,
          }),
        }
      );

      setNewComment("");
      loadComments(selectedTicket.id);
      showNotification("Comment posted successfully!", "success");
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const normalizeEmail = (email) =>
    String(email || "").trim().toLowerCase();

  const loadTickets = useCallback(async (showAll = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const userEmail = normalizeEmail(user.email);
    setCurrentUser(userEmail);

    try {
      const ticketsUrl = showAll
        ? `${API_BASE_URL}/tickets`
        : `${API_BASE_URL}/tickets/user/${encodeURIComponent(userEmail)}`;

      const response = await fetch(ticketsUrl);

      if (!response.ok) {
        throw new Error(`Failed to load tickets (${response.status})`);
      }

      const data = await response.json();
      setTickets(data || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    }
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const createTicket = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showNotification("Please log in first", "error");
      return;
    }

    const userEmail = normalizeEmail(user.email);

    const trimmedSubject = subject.trim();
    const trimmedSummary = summary.trim();

    if (!trimmedSubject || !trimmedSummary) {
      showNotification("Please enter both subject and summary", "error");
      return;
    }

    setIsSubmitting(true);

    let fileUrl = null;

    if (selectedFile) {
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const { error } = await supabase.storage
        .from("ticket-files")
        .upload(fileName, selectedFile);

      if (error) {
        showNotification(error.message, "error");
        setIsSubmitting(false);
        return;
      }

      const { data } = supabase.storage
        .from("ticket-files")
        .getPublicUrl(fileName);

      fileUrl = data.publicUrl;
    }

    try {
      const newTicket = {
        sender: userEmail,
        subject: trimmedSubject,
        summary: trimmedSummary,
        attachment_url: fileUrl,
      };

      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTicket),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      await response.json();

      setSubject("");
      setSummary("");
      setSelectedFile(null);

      await loadTickets();
      showNotification("Ticket submitted successfully!", "success");
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnreadCount = (ticket) => {
    const readCount = readComments[ticket.id] || 0;
    const totalCount = ticket.comment_count || 0;
    return Math.max(0, totalCount - readCount);
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "Open":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "In Progress":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Closed":
        return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text-primary pb-16 selection:bg-brand-primary/30 selection:text-white">
      {/* Dynamic background top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[250px] bg-gradient-to-b from-brand-primary/5 to-transparent blur-[100px] rounded-full pointer-events-none"></div>

      {/* Global Notifications */}
      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 max-w-md w-full px-4"
          >
            <div
              className={`p-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 ${
                notification.type === "success"
                  ? "bg-brand-surface border-brand-success/30 text-brand-success"
                  : "bg-brand-surface border-brand-danger/30 text-brand-danger"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <p className="flex-1 text-xs font-medium leading-normal">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <nav className="border-b bg-brand-surface/40 border-brand-border/40 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary text-xs font-black">
                <Ticket className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold tracking-tight text-sm text-brand-text-primary">
                Customer Console
              </span>
            </div>
            {currentUser && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-brand-elevated/20 text-brand-text-secondary rounded-full border border-brand-border/40 text-[11px] font-medium">
                  <User className="w-3 h-3 text-brand-text-secondary/60" />
                  {currentUser}
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-brand-elevated/40 hover:bg-brand-elevated text-brand-text-primary hover:text-white border border-brand-border/60 hover:border-brand-border text-[11px] font-semibold rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3 h-3 text-brand-text-secondary" />
                  Logout
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Submit New Ticket */}
          <div className="lg:col-span-1">
            <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 sticky top-20 shadow-xl">
              <h2 className="text-sm font-semibold tracking-tight mb-1 text-brand-text-primary">
                Submit a Support Ticket
              </h2>
              <p className="text-[11px] text-brand-text-secondary mb-5 leading-normal">
                Detail your concern. Our system automatically processes classifications and priority triages in real time.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description title"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 placeholder:text-brand-text-secondary/35 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1.5">
                    Detailed Summary
                  </label>
                  <textarea
                    placeholder="What error occurred? Share steps to reproduce..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={isSubmitting}
                    rows={4}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 placeholder:text-brand-text-secondary/35 resize-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold tracking-wider text-brand-text-secondary block mb-1.5">
                    Attachment (Optional)
                  </label>
                  <div className="relative group border border-dashed border-brand-border hover:border-brand-text-secondary/40 rounded-lg p-3 text-center transition duration-150 bg-brand-bg/50">
                    <input
                      type="file"
                      key={selectedFile ? "active" : "empty"}
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-brand-text-secondary/60 group-hover:text-brand-text-secondary" />
                      <span className="text-[11px] font-medium text-brand-text-secondary max-w-[200px] truncate">
                        {selectedFile ? selectedFile.name : "Select or drag file here"}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={createTicket}
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Routing to AI pipeline...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      Submit Ticket
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Ticket Stream / Conversation details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center bg-brand-surface/40 p-4 border border-brand-border/40 rounded-xl backdrop-blur-xs">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary flex items-center gap-2">
                  My Support Stream
                  <span className="px-2 py-0.5 bg-brand-elevated text-brand-text-secondary rounded-full text-[10px] font-bold">
                    {tickets.length}
                  </span>
                </h2>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => loadTickets(false)}
                  className="p-1.5 bg-brand-elevated/40 hover:bg-brand-elevated border border-brand-border/60 text-brand-text-primary rounded-lg transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Reload current stream"
                >
                  <RefreshCw className="w-3 h-3 text-brand-text-secondary" />
                  <span className="hidden sm:inline">Refresh</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => loadTickets(true)}
                  className="px-2.5 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/25 border border-brand-primary/20 text-brand-primary font-semibold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3 h-3" />
                  All Board Tickets
                </motion.button>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-12 text-center shadow-lg">
                <MessageSquare className="w-8 h-8 text-brand-text-secondary/30 mx-auto mb-3" />
                <h3 className="font-semibold text-brand-text-primary text-sm mb-1">No support tickets found</h3>
                <p className="text-xs text-brand-text-secondary leading-normal max-w-xs mx-auto">
                  Get assistance by completing and submitting a ticket form from the left panel.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={ticket.id}
                    className="bg-brand-surface border border-brand-border/60 hover:border-brand-border/90 rounded-xl p-5 shadow-md hover:shadow-lg transition duration-200"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="font-semibold text-sm text-brand-text-primary flex items-center flex-wrap gap-2">
                        {ticket.subject}
                        {getUnreadCount(ticket) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-danger/10 text-brand-danger border border-brand-danger/20 animate-pulse">
                            {getUnreadCount(ticket)} new
                          </span>
                        )}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeStyles(ticket.status)}`}>
                        {ticket.status || "Open"}
                      </span>
                    </div>

                    <p className="text-xs text-brand-text-secondary leading-normal mb-4">
                      {ticket.summary || ticket.description}
                    </p>

                    {ticket.attachment_url && (
                      <div className="mb-4">
                        <a
                          href={ticket.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-elevated/30 border border-brand-border/60 hover:border-brand-border hover:bg-brand-elevated text-brand-text-secondary hover:text-brand-text-primary text-[10px] font-medium rounded-md transition duration-150"
                        >
                          <Paperclip className="w-3 h-3" />
                          View Attachment
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] pt-3.5 border-t border-brand-border/40">
                      <div className="flex gap-4 text-brand-text-secondary/70">
                        <span>Sender: <strong className="text-brand-text-primary font-medium">{ticket.sender}</strong></span>
                        <span>Assignee: <strong className="text-brand-text-primary font-medium">{ticket.assigned_to || "Unassigned"}</strong></span>
                      </div>
                      {ticket.resolution_note && (
                        <div className="text-[10px] font-semibold text-brand-success bg-brand-success/5 border border-brand-success/15 px-2.5 py-0.5 rounded-md">
                          Resolution: {ticket.resolution_note}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-brand-border/30 flex justify-end">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          loadComments(ticket.id);
                        }}
                        className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/20 text-[10px] font-bold rounded-lg transition duration-150 cursor-pointer flex items-center gap-1"
                      >
                        Open Conversation
                        <ChevronRight className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Conversation Logs Dialog Box */}
            <AnimatePresence>
              {selectedTicket && (
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
                        Conversation Log
                      </h2>
                      <p className="text-[11px] text-brand-text-secondary mt-0.5">
                        Discussion thread on ticket <span className="font-semibold text-brand-text-primary">#{selectedTicket.id}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="text-xs text-brand-text-secondary hover:text-brand-text-primary transition underline cursor-pointer font-semibold"
                    >
                      Close Thread
                    </button>
                  </div>

                  <div className="space-y-4 mb-5 max-h-64 overflow-y-auto pr-1">
                    {(!Array.isArray(comments) || comments.length === 0) ? (
                      <div className="text-center py-6 text-brand-text-secondary/50 italic text-xs">
                        No messages have been posted on this support log yet.
                      </div>
                    ) : (
                      comments.map((comment) => {
                        const isSelf = comment.sender === currentUser;
                        return (
                          <div
                            key={comment.id}
                            className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-brand-text-secondary">
                                {comment.sender}
                              </span>
                              <span className="text-[9px] text-brand-text-secondary/40">
                                {comment.created_at ? new Date(comment.created_at).toLocaleTimeString() : ""}
                              </span>
                            </div>
                            <div
                              className={`p-3 rounded-lg text-xs leading-relaxed max-w-[85%] border ${
                                isSelf
                                  ? "bg-brand-primary/10 border-brand-primary/20 text-brand-text-primary rounded-tr-none"
                                  : "bg-brand-elevated/40 border-brand-border/50 text-brand-text-primary rounded-tl-none"
                              }`}
                            >
                              {comment.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-brand-border/40 pt-4 flex gap-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write comment response..."
                      rows={2}
                      className="flex-1 px-3 py-2 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 resize-none placeholder:text-brand-text-secondary/35"
                    />
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={sendComment}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-xs rounded-lg transition shadow-md cursor-pointer flex items-center justify-center shrink-0 self-end h-[38px]"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Paywall Upgrade Modal */}
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

export default UserDashboard;

import { supabase } from "./supabase";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  RefreshCw,
  Send,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  User,
  Sparkles,
  Ticket,
  ArrowRight,
  Loader2,
  ChevronRight,
  X
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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

  const handleTriggerCheckout = async (planName) => {
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
      console.error("Error loading comments:", error);
      setComments([]);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();

    try {
      await fetch(`${API_BASE_URL}/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: user.email, message: newComment }),
      });
      setNewComment("");
      loadComments(selectedTicket.id);
      showNotification("Comment posted successfully!", "success");
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

  const loadTickets = useCallback(async (showAll = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userEmail = normalizeEmail(user.email);
    setCurrentUser(userEmail);

    try {
      const ticketsUrl = showAll
        ? `${API_BASE_URL}/tickets`
        : `${API_BASE_URL}/tickets/user/${encodeURIComponent(userEmail)}`;
      const response = await fetch(ticketsUrl);
      if (!response.ok) throw new Error(`Failed to load tickets (${response.status})`);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => loadTickets())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadTickets]);

  const handleLogout = async () => await supabase.auth.signOut();

  const createTicket = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showNotification("Please log in first", "error");
      return;
    }

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
      const { error } = await supabase.storage.from("ticket-files").upload(fileName, selectedFile);
      if (error) {
        showNotification(error.message, "error");
        setIsSubmitting(false);
        return;
      }
      const { data } = supabase.storage.from("ticket-files").getPublicUrl(fileName);
      fileUrl = data.publicUrl;
    }

    try {
      const newTicket = {
        sender: normalizeEmail(user.email),
        subject: trimmedSubject,
        summary: trimmedSummary,
        attachment_url: fileUrl,
      };

      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setIsSubmitting(false);
        return;
      }
      if (!response.ok) throw new Error("Failed to create ticket");

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
      case "Open": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "In Progress": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Resolved": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Closed": return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
      default: return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text-primary flex flex-col font-sans">
      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-4 left-1/2 z-50 max-w-sm w-full px-4"
          >
            <div className={`px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md flex items-start gap-3 ${
              notification.type === "success"
                ? "bg-brand-surface border-brand-success/20 text-brand-success"
                : "bg-brand-surface border-brand-danger/20 text-brand-danger"
            }`}>
              {notification.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <p className="flex-1 text-sm font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-14 border-b border-brand-border bg-brand-bg sticky top-0 z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-brand-surface border border-brand-border">
            <Ticket className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-brand-text-primary">
            Customer Support
          </span>
        </div>
        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-brand-text-secondary">
              <User className="w-3.5 h-3.5" />
              {currentUser}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-medium text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left Sidebar - New Ticket Form */}
        <aside className="w-full lg:w-[360px] flex-shrink-0 border-r border-brand-border bg-brand-bg p-6 lg:overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-sm font-semibold tracking-tight text-brand-text-primary mb-1">
              New Issue
            </h2>
            <p className="text-xs text-brand-text-secondary">
              Submit a detailed report. Our AI engine automatically triages requests.
            </p>
          </div>
          
          <form onSubmit={createTicket} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-text-primary">Title</label>
              <input
                type="text"
                placeholder="Brief summary of the issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-md text-sm text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-text-primary">Description</label>
              <textarea
                placeholder="Steps to reproduce, expected behavior..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={isSubmitting}
                rows={5}
                className="w-full px-3 py-2 bg-brand-surface border border-brand-border rounded-md text-sm text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors resize-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-text-primary">Attachment (Optional)</label>
              <div className="relative group border border-dashed border-brand-border rounded-md p-3 text-center transition-colors hover:border-brand-text-secondary/40 bg-brand-surface cursor-pointer">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-brand-text-secondary group-hover:text-brand-text-primary transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">
                    {selectedFile ? selectedFile.name : "Attach file"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 font-medium text-sm rounded-md transition-colors cursor-pointer shadow-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Ticket"}
            </button>
          </form>
        </aside>

        {/* Right Content - Ticket List & Conversation */}
        <div className="flex-1 flex flex-col bg-brand-bg min-w-0">
          <div className="flex-1 flex lg:flex-row flex-col min-h-0">
            {/* Tickets List */}
            <div className={`w-full ${selectedTicket ? 'lg:w-[340px] border-r border-brand-border' : 'flex-1'} flex flex-col transition-all duration-300 min-h-0`}>
              <div className="h-12 border-b border-brand-border px-4 flex items-center justify-between shrink-0 bg-brand-surface/30">
                <div className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                  My Issues
                  <span className="px-1.5 py-0.5 bg-brand-elevated text-brand-text-secondary rounded text-[10px] font-medium leading-none">
                    {tickets.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => loadTickets(false)} className="p-1.5 text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface rounded transition-colors" title="Refresh">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-brand-text-secondary pt-12">
                    <MessageSquare className="w-6 h-6 opacity-20 mb-3" />
                    <p className="text-sm font-medium text-brand-text-primary">No issues found</p>
                    <p className="text-xs mt-1">Create a ticket to get started.</p>
                  </div>
                ) : (
                  tickets.map((ticket) => {
                    const isSelected = selectedTicket?.id === ticket.id;
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => { setSelectedTicket(ticket); loadComments(ticket.id); }}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "bg-brand-surface border-brand-border ring-1 ring-brand-primary shadow-sm"
                            : "bg-brand-bg border-transparent hover:bg-brand-surface hover:border-brand-border/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="font-medium text-sm text-brand-text-primary line-clamp-1 flex-1 flex items-center gap-2">
                            {ticket.subject}
                            {getUnreadCount(ticket) > 0 && (
                              <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0" />
                            )}
                          </h3>
                        </div>
                        <p className="text-xs text-brand-text-secondary line-clamp-2 mb-2.5 leading-relaxed">
                          {ticket.summary || ticket.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${getStatusBadgeStyles(ticket.status)}`}>
                            {ticket.status || "Open"}
                          </span>
                          <span className="text-[10px] text-brand-text-secondary font-medium">
                            #{ticket.id.toString().substring(0, 6)}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Conversation Area */}
            {selectedTicket && (
              <div className="flex-1 flex flex-col min-h-0 bg-brand-bg relative">
                <div className="h-12 border-b border-brand-border px-6 flex items-center justify-between shrink-0 bg-brand-surface/30">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-brand-text-primary truncate max-w-[200px] sm:max-w-[400px]">
                      {selectedTicket.subject}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${getStatusBadgeStyles(selectedTicket.status)}`}>
                      {selectedTicket.status || "Open"}
                    </span>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="p-1.5 text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface rounded transition-colors lg:hidden">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  {/* Original Ticket Post */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-brand-text-secondary" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-brand-text-primary">{selectedTicket.sender}</span>
                        <span className="text-[10px] text-brand-text-secondary">Original Issue</span>
                      </div>
                      <div className="text-sm text-brand-text-primary leading-relaxed bg-brand-surface/40 p-4 rounded-lg border border-brand-border/40 whitespace-pre-wrap">
                        {selectedTicket.summary || selectedTicket.description}
                      </div>
                      {selectedTicket.attachment_url && (
                        <div className="pt-2">
                          <a href={selectedTicket.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-surface border border-brand-border hover:border-brand-text-secondary/40 text-xs font-medium text-brand-text-primary rounded-md transition-colors w-fit">
                            <Paperclip className="w-3.5 h-3.5" />
                            View Attachment
                            <ExternalLink className="w-3 h-3 text-brand-text-secondary" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTicket.resolution_note && (
                    <div className="flex gap-4">
                       <div className="w-8 h-8 rounded-full bg-brand-success/10 border border-brand-success/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-brand-success" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-brand-success">Resolution</span>
                        </div>
                        <div className="text-sm text-brand-text-primary leading-relaxed bg-brand-success/5 p-4 rounded-lg border border-brand-success/20">
                          {selectedTicket.resolution_note}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comments Thread */}
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                        comment.sender === currentUser ? "bg-brand-surface border-brand-border" : "bg-brand-primary/10 border-brand-primary/20"
                      }`}>
                        {comment.sender === currentUser ? <User className="w-4 h-4 text-brand-text-secondary" /> : <Sparkles className="w-4 h-4 text-brand-primary" />}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-brand-text-primary">{comment.sender}</span>
                          <span className="text-[10px] text-brand-text-secondary">
                            {comment.created_at ? new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                          </span>
                        </div>
                        <div className="text-sm text-brand-text-primary leading-relaxed">
                          {comment.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-brand-border bg-brand-surface/30">
                  <div className="relative flex items-end gap-2 bg-brand-bg border border-brand-border rounded-lg p-2 focus-within:ring-1 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all shadow-sm">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Reply to this thread..."
                      rows={1}
                      className="flex-1 max-h-32 min-h-[36px] bg-transparent text-sm text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none resize-none py-1.5 px-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendComment();
                        }
                      }}
                    />
                    <button
                      onClick={sendComment}
                      disabled={!newComment.trim()}
                      className="shrink-0 p-2 bg-brand-primary text-white rounded-md disabled:opacity-50 disabled:bg-brand-surface disabled:text-brand-text-secondary transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-[10px] text-brand-text-secondary text-right mt-1.5 px-1">
                    Press <kbd className="font-sans font-medium px-1 bg-brand-surface border border-brand-border rounded">Enter</kbd> to send
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Paywall Modal (Simplified for space) */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-brand-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 relative">
              <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text-primary"><X className="w-4 h-4"/></button>
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-md">Upgrade Required</span>
                <h2 className="text-xl font-semibold mt-3 text-brand-text-primary">Unlock Priority Operations</h2>
                <p className="text-sm text-brand-text-secondary mt-1">Your workspace has exhausted free tier limits.</p>
              </div>
              <div className="border border-brand-primary bg-brand-bg p-4 rounded-lg flex justify-between items-center mb-6 shadow-sm">
                 <div>
                   <h3 className="text-sm font-semibold text-brand-text-primary">Pro Tier</h3>
                   <div className="text-xs text-brand-text-secondary mt-1">Unlimited AI Triaging</div>
                 </div>
                 <div className="text-right">
                   <div className="text-lg font-bold text-brand-text-primary">₹4,999<span className="text-xs text-brand-text-secondary font-normal">/mo</span></div>
                 </div>
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

export default UserDashboard;

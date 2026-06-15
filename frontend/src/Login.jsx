import { useState } from "react";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const handleSignup = async () => {
    if (!email || !password) {
      showNotification("Please enter both email and password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      showNotification(error.message, "error");
      setLoading(false);
    } else {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([
          {
            id: data.user.id,
            email: email,
            role: "user",
          },
        ]);

      if (roleError) {
        showNotification("Signup succeeded, but role mapping failed: " + roleError.message, "error");
      } else {
        showNotification("Signup successful! You can now log in.", "success");
      }
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showNotification("Please enter both email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showNotification(error.message, "error");
      setLoading(false);
    } else {
      // Role mapping session hooks in main.jsx handle redirection
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px]"
      >
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-surface border border-brand-border mb-6">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand-primary" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text-primary mb-1">
            Log in to your account
          </h1>
          <p className="text-sm text-brand-text-secondary">
            Welcome back to the portal
          </p>
        </div>

        <AnimatePresence mode="wait">
          {notification.message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className={`p-3 rounded-lg text-sm flex items-start gap-2.5 ${
                notification.type === "success"
                  ? "bg-brand-success/10 text-brand-success border border-brand-success/20"
                  : "bg-brand-danger/10 text-brand-danger border border-brand-danger/20"
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{notification.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-brand-text-primary">
              Email
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-sm text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-brand-text-primary">
                Password
              </label>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-sm text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors disabled:opacity-50"
            />
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-text-primary text-brand-bg hover:bg-brand-text-primary/90 disabled:opacity-50 disabled:hover:bg-brand-text-primary font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-surface border border-brand-border hover:bg-brand-elevated text-brand-text-primary font-medium text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Create an account
              <ArrowRight className="w-4 h-4 text-brand-text-secondary" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default Login;

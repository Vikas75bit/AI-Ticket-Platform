import { useState } from "react";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";

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

  const handleLogin = async () => {
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative overflow-hidden selection:bg-brand-primary/30 selection:text-white">
      {/* Subtle Linear-like background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-gradient-to-b from-brand-primary/10 to-transparent blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full bg-brand-surface border border-brand-border/60 rounded-2xl p-8 shadow-2xl relative z-10"
      >
        {/* Logo / Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-elevated/40 border border-brand-border/40 rounded-full text-[11px] font-medium text-brand-text-secondary uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
            Portal Access
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-text-primary">
            Welcome Back
          </h1>
          <p className="text-xs text-brand-text-secondary mt-2">
            Sign in to access your intelligent ticket support console.
          </p>
        </div>

        {/* Notifications */}
        <AnimatePresence mode="wait">
          {notification.message && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={`mb-6 p-4 rounded-lg text-xs border flex items-start gap-3 ${
                  notification.type === "success"
                    ? "bg-brand-success/10 border-brand-success/20 text-brand-success"
                    : "bg-brand-danger/10 border-brand-danger/20 text-brand-danger"
                }`}
              >
                {notification.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <p className="flex-1 leading-normal font-medium">{notification.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-semibold tracking-wider text-brand-text-secondary block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary/60" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 placeholder:text-brand-text-secondary/40 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold tracking-wider text-brand-text-secondary block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary/60" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-brand-bg border border-brand-border/60 hover:border-brand-border rounded-lg text-brand-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition duration-150 placeholder:text-brand-text-secondary/40 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? "Authenticating..." : "Sign In"}
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-2.5 bg-brand-elevated/40 hover:bg-brand-elevated border border-brand-border/60 hover:border-brand-border disabled:opacity-50 text-brand-text-primary font-semibold text-xs rounded-lg transition duration-150 cursor-pointer"
            >
              Create Account
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;

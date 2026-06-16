import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Login from "./Login";
import "./index.css";
import UserDashboard from "./UserDashboard";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

function RootApp() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [resolving, setResolving] = useState(true);

  const resolveRole = async (userId) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("id", userId)
      .single();
    setRole(data?.role ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await resolveRole(session.user.id);
      setResolving(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await resolveRole(session.user.id);
        } else {
          setRole(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 mb-4">
            <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
          </div>
          <p className="text-xs text-brand-text-secondary font-medium">Initializing session...</p>
        </div>
      </div>
    );
  }

  let activeKey = "login";
  let ActiveView = <Login />;

  if (session) {
    if (role === "admin") {
      activeKey = "admin";
      ActiveView = <App />;
    } else {
      activeKey = "user";
      ActiveView = <UserDashboard />;
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: "opacity, transform" }}
      >
        {ActiveView}
      </motion.div>
    </AnimatePresence>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
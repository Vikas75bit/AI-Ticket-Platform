import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes("YOUR_SUPABASE_URL")) {
  console.error("⚠️ VITE_SUPABASE_URL is missing or set to placeholder value in environment variables.");
}
if (!supabaseAnonKey || supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
  console.error("⚠️ VITE_SUPABASE_ANON_KEY is missing or set to placeholder value in environment variables.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

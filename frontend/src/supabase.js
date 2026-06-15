import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verify if a string is a valid absolute HTTP/HTTPS URL
const getValidUrl = (url) => {
  if (!url || url.includes("YOUR_SUPABASE_URL")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch (e) {
    // Not a valid URL
  }
  return null;
};

const supabaseUrl = getValidUrl(rawUrl);
const supabaseAnonKey = (rawKey && !rawKey.includes("YOUR_SUPABASE_ANON_KEY")) ? rawKey : null;

if (!supabaseUrl) {
  console.error("⚠️ VITE_SUPABASE_URL is invalid, missing, or set to placeholder value. Value received:", rawUrl);
}
if (!supabaseAnonKey) {
  console.error("⚠️ VITE_SUPABASE_ANON_KEY is missing or set to placeholder value.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

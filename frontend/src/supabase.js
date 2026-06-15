import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

console.log(
  "SUPABASE URL RAW:",
  JSON.stringify(import.meta.env.VITE_SUPABASE_URL)
);

console.log(
  "SUPABASE KEY EXISTS:",
  !!import.meta.env.VITE_SUPABASE_ANON_KEY
);

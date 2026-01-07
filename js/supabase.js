// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ✅ Must look exactly like: https://xxxxxxxxxxxxxxxx.supabase.co
const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";

// ✅ anon public key (long string starting with eyJ...)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
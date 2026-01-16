// /js/config.js
// Put your Supabase project keys here (public keys are safe to expose in frontend)

export const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

// ✅ Clean V1 routes (no feed/dashboard)
export const ROUTES = {
  login: "/auth/login.html",
  setup: "/setup/profile-setup.html",
  home: "/profile/home.html",
};
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ This is what was missing — profile loader
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("Auth error:", error);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    return null;
  }

  return {
    ...user,
    profile
  };
}
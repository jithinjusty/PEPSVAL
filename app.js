<script type="module">
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GgqSqLPMHV7YK0F2ck07sg_2jLMPzeV";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true, // handles ?code=... from confirmation link
    autoRefreshToken: true,
    persistSession: true,
  },
});

/* ---------- DOM helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const goto = (hash) => {
  if (location.hash !== hash) location.hash = hash;
};

/* ---------- Buttons & forms ---------- */
const loginForm   = $("#login-form");
const signupForm  = $("#signup-form");
const logoutBtns  = document.querySelectorAll("[data-logout]");
const saveBtn     = $("#save-profile");
const nameInp     = $("#full_name");
const natInp      = $("#nationality");
const rankInp     = $("#rank");
const dobInp      = $("#dob");
const avatarInp   = $("#avatar");

/* ---------- Routing based on auth/profile ---------- */
async function routeByState() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    goto("#home");
    return;
  }

  // Check if profile row already exists
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("profiles select error", error);
    goto("#home");
    return;
  }

  if (prof) {
    goto("#dashboard");
  } else {
    goto("#setup");
  }
}

/* ---------- Auth listeners ---------- */
supabase.auth.onAuthStateChange(async (event, session) => {
  // After email confirmation redirect, Supabase will fire a session here.
  if (session?.user) {
    await routeByState();
  } else {
    goto("#home");
  }
});

/* ---------- On initial load ---------- */
window.addEventListener("load", async () => {
  // If returning from email confirmation (?code=...), Supabase will process it automatically.
  await routeByState();
});

/* ---------- Login ---------- */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (loginForm.querySelector("[name=email]")  as HTMLInputElement).value.trim();
  const password = (loginForm.querySelector("[name=password]") as HTMLInputElement).value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message || "Login failed");
    return;
  }
  // onAuthStateChange will route
});

/* ---------- Signup (email confirmation required) ---------- */
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (signupForm.querySelector("[name=email]")  as HTMLInputElement).value.trim();
  const password = (signupForm.querySelector("[name=password]") as HTMLInputElement).value;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://pepsval.com/#setup" // after confirm, come back here
    }
  });
  if (error) {
    alert(error.message || "Could not create account");
    return;
  }
  alert("Check your email and confirm to continue.");
});

/* ---------- Logout ---------- */
logoutBtns.forEach((btn) =>
  btn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    goto("#home");
  })
);

/* ---------- Save profile (creates profile row) ---------- */
saveBtn?.addEventListener("click", async () => {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) {
    alert("Please login first.");
    return;
  }

  // Optional avatar upload (to a bucket named 'avatars')
  let avatar_url: string | null = null;
  if (avatarInp?.files?.[0]) {
    const file = avatarInp.files[0];
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (upErr) {
      alert(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    avatar_url = data.publicUrl;
  }

  const payload = {
    id: user.id,
    full_name: nameInp?.value || null,
    nationality: natInp?.value || null,
    rank: rankInp?.value || null,
    dob: dobInp?.value || null,
    avatar_url, // nullable
  };

  // upsert profile
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    alert(error.message || "Could not save profile");
    return;
  }
  goto("#dashboard");
});
</script>
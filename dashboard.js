import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Require login
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const user = data.session.user;

  const profileBtn = document.getElementById("profileBtn");
  const menu = document.getElementById("profileMenu");
  const signOutBtn = document.getElementById("signOutBtn");
  const avatarImg = document.getElementById("profileAvatar");

  // Optional: try to load avatar from profiles table (if you already store avatar_url there)
  // If you don't have it yet, this will just fail silently and keep default image.
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (prof?.avatar_url && avatarImg) avatarImg.src = prof.avatar_url;
  } catch (_) {}

  function openMenu() {
    menu.classList.remove("hidden");
    profileBtn.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    menu.classList.add("hidden");
    profileBtn.setAttribute("aria-expanded", "false");
  }
  function toggleMenu() {
    if (menu.classList.contains("hidden")) openMenu();
    else closeMenu();
  }

  // Toggle menu
  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!menu || menu.classList.contains("hidden")) return;
    const clickedInside = menu.contains(e.target) || profileBtn.contains(e.target);
    if (!clickedInside) closeMenu();
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Sign out
  signOutBtn?.addEventListener("click", async () => {
    signOutBtn.disabled = true;
    signOutBtn.textContent = "Signing out…";

    const { error: outErr } = await supabase.auth.signOut();
    if (outErr) {
      console.error(outErr);
      signOutBtn.disabled = false;
      signOutBtn.textContent = "Sign out";
      alert("Could not sign out. Please try again.");
      return;
    }
    window.location.href = "/auth/login.html";
  });
});
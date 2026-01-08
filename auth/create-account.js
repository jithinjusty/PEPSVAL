// create-account.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("createForm");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const createBtn = document.getElementById("createBtn");

const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

const togglePw = document.getElementById("togglePw");
const togglePw2 = document.getElementById("togglePw2");

function showError(msg) {
  successBox.style.display = "none";
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function showSuccess(msg) {
  errorBox.style.display = "none";
  successBox.textContent = msg;
  successBox.style.display = "block";
}

function setLoading(isLoading) {
  createBtn.disabled = isLoading;
  createBtn.textContent = isLoading ? "Creating..." : "Create account";
}

function toggleInputType(input, btn) {
  const isPw = input.type === "password";
  input.type = isPw ? "text" : "password";
  btn.textContent = isPw ? "Hide" : "Show";
}

togglePw?.addEventListener("click", () => toggleInputType(password, togglePw));
togglePw2?.addEventListener("click", () => toggleInputType(confirmPassword, togglePw2));

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorBox.style.display = "none";
  successBox.style.display = "none";

  const e1 = (email.value || "").trim();
  const p1 = password.value || "";
  const p2 = confirmPassword.value || "";

  if (!e1) return showError("Please enter your email.");
  if (!p1 || p1.length < 6) return showError("Password must be at least 6 characters.");
  if (p1 !== p2) return showError("Passwords do not match.");

  setLoading(true);

  try {
    const redirectTo = `${window.location.origin}/auth/login.html`;

    const { data, error } = await supabase.auth.signUp({
      email: e1,
      password: p1,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: (firstName.value || "").trim(),
          last_name: (lastName.value || "").trim(),
        },
      },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();

      // Common Supabase messages across settings
      if (msg.includes("user already registered") || msg.includes("already registered")) {
        return showError("This email is already registered with Pepsval. Please log in.");
      }
      if (msg.includes("email rate limit")) {
        return showError("Too many requests. Please try again in a few minutes.");
      }
      return showError(error.message || "Could not create account. Please try again.");
    }

    // IMPORTANT:
    // Depending on your Supabase auth settings, Supabase may return a user even if already existing.
    // If identities exist, user will be null or confirmation required.
    // We always show a safe success message.
    showSuccess("Account created. Please check your email to confirm.");
    form.reset();
  } catch (err) {
    showError("Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
});
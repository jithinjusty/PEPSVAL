// PEPSVAL login (UI only for now)
// Next step: connect Supabase auth

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const togglePw = document.getElementById("togglePw");
  const errorBox = document.getElementById("errorBox");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  // Show/Hide password
  togglePw?.addEventListener("click", () => {
    const isPw = password.type === "password";
    password.type = isPw ? "text" : "password";
    togglePw.textContent = isPw ? "🙈" : "👁";
    togglePw.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
  });

  // Temporary login handler (no backend yet)
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();

    const eVal = (email.value || "").trim();
    const pVal = password.value || "";

    if (!eVal) return showError("Please enter your email.");
    if (!pVal) return showError("Please enter your password.");
    if (pVal.length < 6) return showError("Password must be at least 6 characters.");

    // For now: just simulate success
    // Next step we will replace this with Supabase signInWithPassword
    window.location.href = "/create-account.html";
  });
});
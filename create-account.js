document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createForm");
  const errorBox = document.getElementById("errorBox");

  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const email = document.getElementById("email");
  const password = document.getElementById("password");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();

    const fn = firstName.value.trim();
    const ln = lastName.value.trim();
    const em = email.value.trim();
    const pw = password.value;

    if (!fn) return showError("Please enter your first name.");
    if (!ln) return showError("Please enter your last name.");
    if (!em) return showError("Please enter your email.");
    if (!pw) return showError("Please create a password.");
    if (pw.length < 6) return showError("Password must be at least 6 characters.");

    // For now: simulate account creation success
    // Next step will connect Supabase
    window.location.href = "/profile-setup.html";
  });
});
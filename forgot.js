document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");
  const email = document.getElementById("email");
  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
    successBox.style.display = "none";
    successBox.textContent = "";
  }

  function showSuccess(msg) {
    successBox.textContent = msg;
    successBox.style.display = "block";
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const em = (email.value || "").trim();
    if (!em) return showError("Please enter your email.");

    // UI only for now. Next step: Supabase resetPasswordForEmail()
    showSuccess("If an account exists for this email, a reset link will be sent.");

    // clear field (optional)
    // email.value = "";
  });
});
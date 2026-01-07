// Always hide app first (prevents login flashing before splash)
document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash");
  const app = document.getElementById("app");

  if (app) app.style.display = "none";

  // Show splash for 3 seconds
  setTimeout(() => {
    if (splash) splash.style.display = "none";
    if (app) app.style.display = "flex";
  }, 3000);
});
document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash");
  const app = document.getElementById("app");

  // Always hide app until splash ends
  app.style.display = "none";

  // Keep splash for 3 seconds
  setTimeout(() => {
    splash.style.opacity = "0";
    splash.style.transition = "opacity 0.6s ease";

    setTimeout(() => {
      splash.style.display = "none";
      app.style.display = "flex";
    }, 600);

  }, 3000);
});
// Show splash for 3 seconds, then show the app
setTimeout(() => {
  const splash = document.getElementById("splash");
  const app = document.getElementById("app");

  if (splash) splash.style.display = "none";
  if (app) app.style.display = "flex";
}, 3000);
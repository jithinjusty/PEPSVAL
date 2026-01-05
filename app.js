// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Auth modal
const modal = document.getElementById("authModal");
const title = document.getElementById("authTitle");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");

window.openAuth = (mode) => {
  modal.setAttribute("aria-hidden", "false");
  if (mode === "signup") {
    title.textContent = "Join PEPSVAL";
    tabSignup?.classList.add("is-active");
    tabLogin?.classList.remove("is-active");
  } else {
    title.textContent = "Sign in to PEPSVAL";
    tabLogin?.classList.add("is-active");
    tabSignup?.classList.remove("is-active");
  }
};

window.closeAuth = () => {
  modal.setAttribute("aria-hidden", "true");
};

// PWA install
let deferredPrompt = null;

const installBtn = document.getElementById("installBtn");
const installBtnMobile = document.getElementById("installBtnMobile");
const installHint = document.getElementById("installHint");

window.addEventListener("beforeinstallprompt", (e) => {
  // Chrome/Android will fire this when installable
  e.preventDefault();
  deferredPrompt = e;

  if (installBtn) installBtn.hidden = false;
  if (installBtnMobile) installBtnMobile.hidden = false;
  if (installHint) installHint.hidden = true;
});

async function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;

  if (installBtn) installBtn.hidden = true;
  if (installBtnMobile) installBtnMobile.hidden = true;
}

installBtn?.addEventListener("click", triggerInstall);
installBtnMobile?.addEventListener("click", triggerInstall);

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

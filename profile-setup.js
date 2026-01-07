document.addEventListener("DOMContentLoaded", () => {
  const accountType = document.getElementById("accountType");

  const seafarerFields = document.querySelectorAll(".onlySeafarer");
  const employerFields = document.querySelectorAll(".onlyEmployer");
  const shoreFields = document.querySelectorAll(".onlyShore");

  const rankSeafarer = document.getElementById("rankSeafarer");
  const roleEmployer = document.getElementById("roleEmployer");
  const roleShore = document.getElementById("roleShore");

  const nationality = document.getElementById("nationality");
  const phoneCode = document.getElementById("phoneCode");
  const phoneNumber = document.getElementById("phoneNumber");

  const photo = document.getElementById("photo");
  const avatarPreview = document.getElementById("avatarPreview");

  const saveBtn = document.getElementById("saveBtn");
  const errorBox = document.getElementById("errorBox");

  function show(nodes) { nodes.forEach(n => (n.style.display = "grid")); }
  function hide(nodes) { nodes.forEach(n => (n.style.display = "none")); }

  function updateAccountTypeUI() {
    const type = accountType.value;

    // Hide all
    hide(seafarerFields);
    hide(employerFields);
    hide(shoreFields);

    // Show only relevant
    if (type === "seafarer") show(seafarerFields);
    if (type === "employer") show(employerFields);
    if (type === "shore") show(shoreFields);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  // Photo preview (local only)
  photo.addEventListener("change", () => {
    const file = photo.files && photo.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    avatarPreview.innerHTML = `<img src="${url}" alt="Profile photo">`;
  });

  accountType.addEventListener("change", updateAccountTypeUI);
  updateAccountTypeUI();

  saveBtn.addEventListener("click", () => {
    clearError();

    const type = accountType.value;

    // Validate role/rank by type
    if (type === "seafarer" && !rankSeafarer.value) {
      return showError("Please select your rank.");
    }
    if (type === "employer" && !roleEmployer.value) {
      return showError("Please select your role.");
    }
    if (type === "shore" && !roleShore.value) {
      return showError("Please select your role.");
    }

    if (!nationality.value) {
      return showError("Please select your nationality.");
    }

    // Phone optional, but if filled ensure at least 6 digits
    const pn = (phoneNumber.value || "").trim();
    if (pn && pn.replace(/\D/g, "").length < 6) {
      return showError("Please enter a valid phone number.");
    }

    // Temporary success redirect (next step we will save in Supabase)
    window.location.href = "/sea-service.html";
  });
});
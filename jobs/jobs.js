import { requireAuth, getMyProfile } from "/js/guard.js";

const jobsTitle = document.getElementById("jobsTitle");
const jobsNavLabel = document.getElementById("jobsNavLabel");
const jobsCard = document.getElementById("jobsCard");

function setCard(title, subtitle, extraHTML = "") {
  if (!jobsCard) return;
  jobsCard.innerHTML = `
    <div style="font-weight:900;font-size:18px;">${title}</div>
    <div class="muted" style="margin-top:6px;">${subtitle}</div>
    ${extraHTML ? `<div style="margin-top:12px;">${extraHTML}</div>` : ""}
  `;
}

function roleToJobsLabel(role) {
  if (role === "company") return "Post Jobs";
  if (role === "professional") return "Opportunities";
  return "Find Jobs"; // seafarer default
}

(async () => {
  const session = await requireAuth();
  if (!session) return;

  const me = await getMyProfile(session.user.id);
  if (!me || me.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  const role = (me.role || "").trim();

  const label = roleToJobsLabel(role);
  if (jobsTitle) jobsTitle.textContent = label;
  if (jobsNavLabel) jobsNavLabel.textContent = label;

  // Role-specific content (UI now, DB later)
  if (role === "company") {
    setCard(
      "Post a job (coming next)",
      "This space is for companies/institutes to create and manage job posts.",
      `
        <div class="muted">Next we’ll add: job post form → approvals → applicants → chat.</div>
        <div style="margin-top:10px;">
          <button class="pv-btn" type="button" disabled>+ Create job (soon)</button>
        </div>
      `
    );
    return;
  }

  if (role === "professional") {
    setCard(
      "Opportunities (coming next)",
      "You’ll see shore-side roles and maritime opportunities here.",
      `<div class="muted">Next we’ll add: filters by location/role + save jobs.</div>`
    );
    return;
  }

  // Seafarer
  setCard(
    "Find jobs (coming next)",
    "You’ll see verified job posts here with vessel/contract details.",
    `<div class="muted">Next we’ll add: rank filters, company verification, and apply button.</div>`
  );
})();
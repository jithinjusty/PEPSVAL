import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const typeBadge = document.getElementById("typeBadge");
const elProfileName = document.getElementById("profileName");
const elMiniTitleLabel = document.getElementById("miniTitleLabel");
const elMiniTitle = document.getElementById("miniTitle");
const elMiniNationality = document.getElementById("miniNationality");

const aboutTitle = document.getElementById("aboutTitle");
const titleLabel = document.getElementById("titleLabel");

const tabSeaBtn = document.getElementById("tabSeaBtn");
const tabDocumentsBtn = document.getElementById("tabDocumentsBtn");
const tabExperienceBtn = document.getElementById("tabExperienceBtn");

const avatarFallback = document.getElementById("avatarFallback");

const fields = {
  full_name: document.getElementById("fullName"),
  titleValue: document.getElementById("titleValue"),
  nationality: document.getElementById("nationality"),
  bio: document.getElementById("bio"),
  email: document.getElementById("email"),
};

// Professional experience UI
const proExpWrap = document.getElementById("proExpWrap");
const proSummary = document.getElementById("proSummary");
const proServices = document.getElementById("proServices");
const proAchievements = document.getElementById("proAchievements");
const addExpBtn = document.getElementById("addExpBtn");
const expList = document.getElementById("expList");

// Company UI
const companyWrap = document.getElementById("companyWrap");
const coWhat = document.getElementById("coWhat");
const coMission = document.getElementById("coMission");
const coVision = document.getElementById("coVision");
const coValues = document.getElementById("coValues");
const coWorkers = document.getElementById("coWorkers");
const coServices = document.getElementById("coServices");
const coAchievements = document.getElementById("coAchievements");

let currentUserId = null;
let currentRole = "seafarer";
let editMode = false;

// Professional experiences in memory
let expItems = []; // [{id, company, position, start_date, end_date, currently_working, location, description, sort_order}]

function safeText(v, fallback = "—") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function normalizeEditableValue(v) {
  const t = (v ?? "").toString().trim();
  if (!t || t === "—") return null;
  return t;
}

function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const first = parts[0][0] || "";
  const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
  return (first + last).toUpperCase() || "P";
}

function roleLabel(role) {
  if (role === "company") return "Company / Institute";
  if (role === "professional") return "Maritime Professional";
  return "Seafarer";
}

function titleLabelForRole(role) {
  if (role === "company") return "Company type";
  if (role === "professional") return "Professional role";
  return "Ship role";
}

function aboutTitleForRole(role) {
  if (role === "company") return "Company profile";
  if (role === "professional") return "Professional profile";
  return "Seafarer profile";
}

function textToLines(t) {
  return (t || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

function linesToText(arr) {
  return (arr || []).join("\n");
}

function setEditable(state) {
  editMode = state;

  // About fields use contentEditable
  const aboutEditable = [fields.full_name, fields.titleValue, fields.nationality, fields.bio];
  aboutEditable.forEach(el => {
    if (!el) return;
    el.contentEditable = state;
    el.style.background = state ? "#eef6fb" : "";
  });

  // Professional inputs
  if (proSummary) proSummary.disabled = !state;
  if (proServices) proServices.disabled = !state;
  if (proAchievements) proAchievements.disabled = !state;
  if (addExpBtn) addExpBtn.disabled = !state;

  // Company inputs
  [coWhat, coMission, coVision, coValues, coWorkers, coServices, coAchievements].forEach(el => {
    if (!el) return;
    el.disabled = !state;
    el.style.background = state ? "#eef6fb" : "";
  });

  // Re-render experiences so inputs enable/disable
  renderExperienceList();

  editBtn?.classList.toggle("hidden", state);
  saveBtn?.classList.toggle("hidden", !state);
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  tabs.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
}

function switchTab(name) {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const panes = ["about", "posts", "documents", "experience", "sea"].map(x => document.getElementById(`tab_${x}`));

  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  panes.forEach(p => {
    if (!p) return;
    p.classList.toggle("hidden", p.id !== `tab_${name}`);
  });
}

function applyRoleUI(role) {
  currentRole = (role || "seafarer").trim();
  if (typeBadge) typeBadge.textContent = roleLabel(currentRole);

  const titleLbl = titleLabelForRole(currentRole);
  if (titleLabel) titleLabel.textContent = titleLbl;
  if (elMiniTitleLabel) elMiniTitleLabel.textContent = titleLbl;
  if (aboutTitle) aboutTitle.textContent = aboutTitleForRole(currentRole);

  const isSeafarer = currentRole === "seafarer";

  // Seafarer sees Documents + Sea Service
  if (tabSeaBtn) tabSeaBtn.style.display = isSeafarer ? "" : "none";
  if (tabDocumentsBtn) tabDocumentsBtn.style.display = isSeafarer ? "" : "none";

  // Company/Professional sees Experience
  if (tabExperienceBtn) tabExperienceBtn.style.display = isSeafarer ? "none" : "";

  // Experience pane split
  if (proExpWrap) proExpWrap.classList.toggle("hidden", currentRole !== "professional");
  if (companyWrap) companyWrap.classList.toggle("hidden", currentRole !== "company");

  // If role hides current tab, bounce to About
  if (!isSeafarer) {
    const seaPane = document.getElementById("tab_sea");
    const docsPane = document.getElementById("tab_documents");
    if (seaPane && !seaPane.classList.contains("hidden")) switchTab("about");
    if (docsPane && !docsPane.classList.contains("hidden")) switchTab("about");
  }
}

async function fetchProfileRow(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, rank, nationality, bio, setup_complete")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

/* ---------------- Professional Experience UI ---------------- */

function newExpItem() {
  return {
    id: null,
    company: "",
    position: "",
    start_date: "",
    end_date: "",
    currently_working: false,
    location: "",
    description: "",
    sort_order: expItems.length
  };
}

function renderExperienceList() {
  if (!expList) return;
  expList.innerHTML = "";

  expItems
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "box span2";
      card.style.marginBottom = "12px";

      card.innerHTML = `
        <div class="k">Experience #${idx + 1}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
          <div>
            <div class="k" style="margin-bottom:6px;">Company</div>
            <input data-f="company" type="text" placeholder="Company name" style="width:100%;" />
          </div>
          <div>
            <div class="k" style="margin-bottom:6px;">Role / Position</div>
            <input data-f="position" type="text" placeholder="Role/Position" style="width:100%;" />
          </div>
          <div>
            <div class="k" style="margin-bottom:6px;">Start date</div>
            <input data-f="start_date" type="date" style="width:100%;" />
          </div>
          <div>
            <div class="k" style="margin-bottom:6px;">End date</div>
            <input data-f="end_date" type="date" style="width:100%;" />
          </div>
          <div style="grid-column:1 / -1;">
            <label style="display:flex;align-items:center;gap:8px;">
              <input data-f="currently_working" type="checkbox" />
              <span class="muted">Currently working here</span>
            </label>
          </div>
          <div style="grid-column:1 / -1;">
            <div class="k" style="margin-bottom:6px;">Location (optional)</div>
            <input data-f="location" type="text" placeholder="City / Country" style="width:100%;" />
          </div>
          <div style="grid-column:1 / -1;">
            <div class="k" style="margin-bottom:6px;">Description (optional)</div>
            <textarea data-f="description" rows="4" style="width:100%;resize:vertical" placeholder="Work details, responsibilities, achievements…"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
          <button class="btnGhost" type="button" data-act="up">↑ Move up</button>
          <button class="btnGhost" type="button" data-act="down">↓ Move down</button>
          <button class="btnGhost" type="button" data-act="delete">Delete</button>
        </div>
      `;

      // Fill values
      const setVal = (sel, val) => {
        const el = card.querySelector(sel);
        if (!el) return;
        if (el.type === "checkbox") el.checked = !!val;
        else el.value = val ?? "";
        el.disabled = !editMode;
      };

      setVal('[data-f="company"]', it.company);
      setVal('[data-f="position"]', it.position);
      setVal('[data-f="start_date"]', it.start_date || "");
      setVal('[data-f="end_date"]', it.end_date || "");
      setVal('[data-f="currently_working"]', it.currently_working);
      setVal('[data-f="location"]', it.location);
      setVal('[data-f="description"]', it.description);

      // Wire input updates
      card.querySelectorAll("[data-f]").forEach(input => {
        input.addEventListener("input", () => {
          const f = input.getAttribute("data-f");
          if (f === "currently_working") it.currently_working = input.checked;
          else it[f] = input.value;
        });
        input.addEventListener("change", () => {
          const f = input.getAttribute("data-f");
          if (f === "currently_working") it.currently_working = input.checked;
          else it[f] = input.value;
        });
      });

      // Wire actions
      card.querySelectorAll("[data-act]").forEach(btn => {
        btn.disabled = !editMode;
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-act");
          if (act === "delete") {
            expItems = expItems.filter(x => x !== it);
            // reindex sort_order
            expItems.forEach((x, i) => x.sort_order = i);
            renderExperienceList();
          }
          if (act === "up") {
            const i = expItems.indexOf(it);
            if (i > 0) {
              [expItems[i - 1], expItems[i]] = [expItems[i], expItems[i - 1]];
              expItems.forEach((x, k) => x.sort_order = k);
              renderExperienceList();
            }
          }
          if (act === "down") {
            const i = expItems.indexOf(it);
            if (i < expItems.length - 1) {
              [expItems[i + 1], expItems[i]] = [expItems[i], expItems[i + 1]];
              expItems.forEach((x, k) => x.sort_order = k);
              renderExperienceList();
            }
          }
        });
      });

      expList.appendChild(card);
    });
}

/* ---------------- Load role-specific DB data ---------------- */

async function loadProfessionalDetails() {
  // details
  const { data: det, error: detErr } = await supabase
    .from("professional_details")
    .select("summary, services, achievements")
    .eq("profile_id", currentUserId)
    .maybeSingle();

  if (!detErr && det) {
    if (proSummary) proSummary.value = det.summary || "";
    if (proServices) proServices.value = linesToText(det.services || []);
    if (proAchievements) proAchievements.value = linesToText(det.achievements || []);
  } else {
    if (proSummary) proSummary.value = "";
    if (proServices) proServices.value = "";
    if (proAchievements) proAchievements.value = "";
  }

  // experiences
  const { data: exps, error: expErr } = await supabase
    .from("professional_experience")
    .select("id, company, position, start_date, end_date, currently_working, location, description, sort_order")
    .eq("profile_id", currentUserId)
    .order("sort_order", { ascending: true });

  expItems = expErr ? [] : (exps || []).map(x => ({
    ...x,
    start_date: x.start_date || "",
    end_date: x.end_date || ""
  }));

  renderExperienceList();
}

async function loadCompanyDetails() {
  const { data: det, error } = await supabase
    .from("company_details")
    .select("what_we_are, mission, vision, core_values, services, achievements, total_workers")
    .eq("profile_id", currentUserId)
    .maybeSingle();

  if (!error && det) {
    if (coWhat) coWhat.value = det.what_we_are || "";
    if (coMission) coMission.value = det.mission || "";
    if (coVision) coVision.value = det.vision || "";
    if (coValues) coValues.value = det.core_values || "";
    if (coWorkers) coWorkers.value = (det.total_workers ?? "") === null ? "" : String(det.total_workers ?? "");
    if (coServices) coServices.value = linesToText(det.services || []);
    if (coAchievements) coAchievements.value = linesToText(det.achievements || []);
  } else {
    if (coWhat) coWhat.value = "";
    if (coMission) coMission.value = "";
    if (coVision) coVision.value = "";
    if (coValues) coValues.value = "";
    if (coWorkers) coWorkers.value = "";
    if (coServices) coServices.value = "";
    if (coAchievements) coAchievements.value = "";
  }
}

async function loadProfile() {
  const session = await requireAuth();
  if (!session) return;

  const me = await getMyProfile(session.user.id);
  if (!me || me.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  currentUserId = session.user.id;

  const p = await fetchProfileRow(currentUserId);
  applyRoleUI(p.role);

  // About fields
  fields.full_name.textContent = safeText(p.full_name);
  fields.titleValue.textContent = safeText(p.rank);
  fields.nationality.textContent = safeText(p.nationality);
  fields.bio.textContent = safeText(p.bio);
  fields.email.textContent = safeText(session.user.email);

  // Header
  elProfileName.textContent = safeText(p.full_name, "Profile");
  elMiniTitle.textContent = safeText(p.rank);
  elMiniNationality.textContent = safeText(p.nationality);

  // Avatar initials
  if (avatarFallback) avatarFallback.textContent = initialsFromName(p.full_name || session.user.email || "P");

  // Role-specific load
  if (currentRole === "professional") await loadProfessionalDetails();
  if (currentRole === "company") await loadCompanyDetails();

  setEditable(false);
}

/* ---------------- Save role-specific data ---------------- */

async function saveProfessionalData() {
  const payload = {
    profile_id: currentUserId,
    summary: (proSummary?.value || "").trim() || null,
    services: textToLines(proServices?.value || ""),
    achievements: textToLines(proAchievements?.value || ""),
    updated_at: new Date().toISOString()
  };

  const { error: dErr } = await supabase
    .from("professional_details")
    .upsert(payload, { onConflict: "profile_id" });

  if (dErr) throw dErr;

  // Simplest safe sync: delete all then insert again
  const { error: delErr } = await supabase
    .from("professional_experience")
    .delete()
    .eq("profile_id", currentUserId);

  if (delErr) throw delErr;

  const cleaned = expItems
    .filter(x => (x.company || "").trim() && (x.position || "").trim())
    .map((x, i) => ({
      profile_id: currentUserId,
      company: (x.company || "").trim(),
      position: (x.position || "").trim(),
      start_date: x.start_date || null,
      end_date: x.currently_working ? null : (x.end_date || null),
      currently_working: !!x.currently_working,
      location: (x.location || "").trim() || null,
      description: (x.description || "").trim() || null,
      sort_order: i
    }));

  if (cleaned.length) {
    const { error: insErr } = await supabase.from("professional_experience").insert(cleaned);
    if (insErr) throw insErr;
  }
}

async function saveCompanyData() {
  const workersVal = (coWorkers?.value || "").trim();
  const totalWorkers = workersVal === "" ? null : Number(workersVal);

  const payload = {
    profile_id: currentUserId,
    what_we_are: (coWhat?.value || "").trim() || null,
    mission: (coMission?.value || "").trim() || null,
    vision: (coVision?.value || "").trim() || null,
    core_values: (coValues?.value || "").trim() || null,
    services: textToLines(coServices?.value || ""),
    achievements: textToLines(coAchievements?.value || ""),
    total_workers: Number.isFinite(totalWorkers) ? totalWorkers : null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("company_details")
    .upsert(payload, { onConflict: "profile_id" });

  if (error) throw error;
}

/* ---------------- Actions ---------------- */

addExpBtn?.addEventListener("click", () => {
  if (!editMode) return;
  expItems.push(newExpItem());
  expItems.forEach((x, i) => x.sort_order = i);
  renderExperienceList();
});

editBtn?.addEventListener("click", () => setEditable(true));

saveBtn?.addEventListener("click", async () => {
  if (!currentUserId) return;

  try {
    // Save About section (profiles)
    const updates = {
      full_name: normalizeEditableValue(fields.full_name.textContent),
      rank: normalizeEditableValue(fields.titleValue.textContent),
      nationality: normalizeEditableValue(fields.nationality.textContent),
      bio: normalizeEditableValue(fields.bio.textContent),
      updated_at: new Date().toISOString()
    };

    Object.keys(updates).forEach(k => {
      if (updates[k] === null) delete updates[k];
    });

    const { error: pErr } = await supabase.from("profiles").update(updates).eq("id", currentUserId);
    if (pErr) throw pErr;

    // Save role-specific
    if (currentRole === "professional") await saveProfessionalData();
    if (currentRole === "company") await saveCompanyData();

    setEditable(false);
    await loadProfile();
  } catch (e) {
    console.error("Save failed:", e);
    alert("Save failed: " + (e.message || "Unknown error"));
  }
});

/* ---------------- Init ---------------- */

(function init() {
  wireTabs();
  loadProfile().catch(e => {
    console.error("Profile load error:", e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  });
})();
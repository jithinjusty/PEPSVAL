import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

/* ---------------- Elements ---------------- */
const $ = (id) => document.getElementById(id);

const els = {
  // header
  typeBadge: $("typeBadge"),
  profileName: $("profileName"),
  miniTitleLabel: $("miniTitleLabel"),
  miniTitle: $("miniTitle"),
  miniNationality: $("miniNationality"),

  aboutTitle: $("aboutTitle"),
  titleLabel: $("titleLabel"),
  expTitle: $("expTitle"),

  tabSeaBtn: $("tabSeaBtn"),
  tabDocumentsBtn: $("tabDocumentsBtn"),
  tabExperienceBtn: $("tabExperienceBtn"),

  // about fields
  fullName: $("fullName"),
  email: $("email"),
  titleValue: $("titleValue"),
  nationality: $("nationality"),
  bio: $("bio"),

  // about buttons
  editAboutBtn: $("editAboutBtn"),
  saveAboutBtn: $("saveAboutBtn"),

  // experience buttons
  editExpBtn: $("editExpBtn"),
  saveExpBtn: $("saveExpBtn"),

  // seafarer rank combo (inside About edit)
  rankEditWrap: $("rankEditWrap"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),

  // professional experience
  proExpWrap: $("proExpWrap"),
  proSummary: $("proSummary"),
  proServices: $("proServices"),
  proAchievements: $("proAchievements"),
  addExpBtn: $("addExpBtn"),
  expList: $("expList"),

  // company
  companyWrap: $("companyWrap"),
  coWhat: $("coWhat"),
  coMission: $("coMission"),
  coVision: $("coVision"),
  coValues: $("coValues"),
  coWorkers: $("coWorkers"),
  coServices: $("coServices"),
  coAchievements: $("coAchievements"),

  // avatar
  avatarBtn: $("avatarBtn"),
  avatarImg: $("avatarImg"),
  avatarFallback: $("avatarFallback"),
  avatarFile: $("avatarFile"),

  // crop modal
  cropBack: $("cropBack"),
  cropClose: $("cropClose"),
  cropCancel: $("cropCancel"),
  cropSave: $("cropSave"),
  cropCanvas: $("cropCanvas"),
  zoomRange: $("zoomRange"),

  // filters (we’ll inject if not present)
};

/* ---------------- State ---------------- */
let currentUserId = null;
let currentRole = "seafarer";
let aboutEdit = false;
let expEdit = false;
let expItems = [];

/* ---------------- Ship roles only (Seafarer) ---------------- */
const SEAFARER_RANKS = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Fourth Officer / 4/O",
  "Deck Cadet / Trainee",
  "Bosun",
  "AB / Able Seaman",
  "OS / Ordinary Seaman",
  "Pumpman",
  "Fitter",
  "Cook / Messman",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Fifth Engineer / Junior Engineer",
  "Engine Cadet / Trainee",
  "Motorman",
  "Oiler",
  "Wiper",
  "ETO / Electro-Technical Officer",
  "Electrician",
  "Other"
];

/* ---------------- Helpers ---------------- */
function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

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
function expTitleForRole(role) {
  if (role === "company") return "Company profile";
  if (role === "professional") return "Experience";
  return "Experience";
}
function textToLines(t) {
  return (t || "").split("\n").map(x => x.trim()).filter(Boolean);
}
function linesToText(arr) {
  return (arr || []).join("\n");
}

/* ---------------- Tabs ---------------- */
function wireTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  tabs.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
}
function switchTab(name) {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const panes = ["about", "posts", "documents", "experience", "sea"].map(x => document.getElementById(`tab_${x}`));
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  panes.forEach(p => p && p.classList.toggle("hidden", p.id !== `tab_${name}`));
}

/* ---------------- Rank Combo ---------------- */
function showList(listEl){
  if (!listEl) return;
  listEl.classList.add("show");
}
function hideList(listEl){
  if (!listEl) return;
  listEl.classList.remove("show");
}
function renderRankList(items){
  if (!els.rankList) return;
  els.rankList.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "comboEmpty";
    empty.textContent = "No results";
    els.rankList.appendChild(empty);
    return;
  }
  items.forEach((r) => {
    const row = document.createElement("div");
    row.className = "comboItem";
    row.innerHTML = `<strong>${r}</strong>`;
    row.addEventListener("click", () => {
      els.rankSearch.value = r;
      els.rankValue.value = r;
      if (r === "Other") show(els.rankOtherWrap); else hide(els.rankOtherWrap);
      hideList(els.rankList);
    });
    els.rankList.appendChild(row);
  });
}
function wireRankCombo(){
  if (!els.rankSearch || !els.rankList) return;

  const filterNow = () => {
    const q = (els.rankSearch.value || "").toLowerCase().trim();
    const filtered = !q
      ? SEAFARER_RANKS.slice(0, 200)
      : SEAFARER_RANKS.filter(r => r.toLowerCase().includes(q)).slice(0, 200);
    renderRankList(filtered);
    showList(els.rankList);
  };

  els.rankSearch.addEventListener("focus", filterNow);
  els.rankSearch.addEventListener("input", filterNow);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`[data-combo="rank"]`)) hideList(els.rankList);
  });

  renderRankList(SEAFARER_RANKS.slice(0, 120));
}

/* ---------------- Role UI ---------------- */
function applyRoleUI(role) {
  currentRole = (role || "seafarer").trim();

  if (els.typeBadge) els.typeBadge.textContent = roleLabel(currentRole);

  const tLbl = titleLabelForRole(currentRole);
  if (els.titleLabel) els.titleLabel.textContent = tLbl;
  if (els.miniTitleLabel) els.miniTitleLabel.textContent = tLbl;
  if (els.aboutTitle) els.aboutTitle.textContent = aboutTitleForRole(currentRole);
  if (els.expTitle) els.expTitle.textContent = expTitleForRole(currentRole);

  const isSeafarer = currentRole === "seafarer";
  if (els.tabSeaBtn) els.tabSeaBtn.style.display = isSeafarer ? "" : "none";
  if (els.tabDocumentsBtn) els.tabDocumentsBtn.style.display = isSeafarer ? "" : "none";
  if (els.tabExperienceBtn) els.tabExperienceBtn.style.display = isSeafarer ? "none" : "";

  if (els.proExpWrap) els.proExpWrap.classList.toggle("hidden", currentRole !== "professional");
  if (els.companyWrap) els.companyWrap.classList.toggle("hidden", currentRole !== "company");

  // Experience edit buttons only for non-seafarer
  const expBtnsVisible = !isSeafarer;
  els.editExpBtn?.classList.toggle("hidden", !expBtnsVisible || expEdit);
  els.saveExpBtn?.classList.toggle("hidden", !expBtnsVisible || !expEdit);

  // About: show rank dropdown only for seafarer while editing
  if (els.rankEditWrap) els.rankEditWrap.classList.toggle("hidden", !(isSeafarer && aboutEdit));
}

/* ---------------- About Edit ---------------- */
function setAboutEditable(state) {
  aboutEdit = state;

  const aboutEditable = [els.fullName, els.nationality, els.bio];
  aboutEditable.forEach(el => {
    if (!el) return;
    el.contentEditable = state;
    el.style.background = state ? "#eef6fb" : "";
  });

  const isSeafarer = currentRole === "seafarer";

  if (els.titleValue) {
    if (isSeafarer) {
      els.titleValue.contentEditable = false;
      els.titleValue.style.background = "";
      if (els.rankEditWrap) els.rankEditWrap.classList.toggle("hidden", !state);

      if (state) {
        const cur = (els.titleValue.textContent || "").trim();
        const match = SEAFARER_RANKS.includes(cur) ? cur : (cur ? "Other" : "");
        els.rankSearch.value = match || "";
        els.rankValue.value = match || "";
        if (match === "Other") show(els.rankOtherWrap); else hide(els.rankOtherWrap);
        if (match === "Other" && els.rankOther) els.rankOther.value = cur && cur !== "Other" ? cur : "";
      } else {
        hide(els.rankOtherWrap);
      }
    } else {
      if (els.rankEditWrap) hide(els.rankEditWrap);
      els.titleValue.contentEditable = state;
      els.titleValue.style.background = state ? "#eef6fb" : "";
    }
  }

  els.editAboutBtn?.classList.toggle("hidden", state);
  els.saveAboutBtn?.classList.toggle("hidden", !state);

  applyRoleUI(currentRole);
}

/* ---------------- Experience Edit
---------------- */
function setExperienceEditable(state) {
  expEdit = state;

  [els.proSummary, els.proServices, els.proAchievements].forEach(el => {
    if (!el) return;
    el.disabled = !state;
    el.style.background = state ? "#eef6fb" : "";
  });
  if (els.addExpBtn) els.addExpBtn.disabled = !state;

  [els.coWhat, els.coMission, els.coVision, els.coValues, els.coWorkers, els.coServices, els.coAchievements].forEach(el => {
    if (!el) return;
    el.disabled = !state;
    el.style.background = state ? "#eef6fb" : "";
  });

  renderExperienceList();

  els.editExpBtn?.classList.toggle("hidden", state);
  els.saveExpBtn?.classList.toggle("hidden", !state);
}

/* ---------------- Experience Cards (Professional) ---------------- */
function newExpItem() {
  return {
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
  if (!els.expList) return;
  els.expList.innerHTML = "";

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
            <input data-f="company" type="text" style="width:100%;" />
          </div>
          <div>
            <div class="k" style="margin-bottom:6px;">Role / Position</div>
            <input data-f="position" type="text" style="width:100%;" />
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
            <input data-f="location" type="text" style="width:100%;" />
          </div>
          <div style="grid-column:1 / -1;">
            <div class="k" style="margin-bottom:6px;">Description (optional)</div>
            <textarea data-f="description" rows="4" style="width:100%;resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
          <button class="btnGhost" type="button" data-act="up">↑ Move up</button>
          <button class="btnGhost" type="button" data-act="down">↓ Move down</button>
          <button class="btnGhost" type="button" data-act="delete">Delete</button>
        </div>
      `;

      const setVal = (sel, val) => {
        const el = card.querySelector(sel);
        if (!el) return;
        if (el.type === "checkbox") el.checked = !!val;
        else el.value = val ?? "";
        el.disabled = !expEdit;
      };

      setVal('[data-f="company"]', it.company);
      setVal('[data-f="position"]', it.position);
      setVal('[data-f="start_date"]', it.start_date || "");
      setVal('[data-f="end_date"]', it.end_date || "");
      setVal('[data-f="currently_working"]', it.currently_working);
      setVal('[data-f="location"]', it.location);
      setVal('[data-f="description"]', it.description);

      card.querySelectorAll("[data-f]").forEach(input => {
        const update = () => {
          const f = input.getAttribute("data-f");
          if (f === "currently_working") it.currently_working = input.checked;
          else it[f] = input.value;
        };
        input.addEventListener("input", update);
        input.addEventListener("change", update);
      });

      card.querySelectorAll("[data-act]").forEach(btn => {
        btn.disabled = !expEdit;
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-act");
          if (act === "delete") {
            expItems = expItems.filter(x => x !== it);
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

      els.expList.appendChild(card);
    });
}

/* ---------------- Avatar: Crop + Filters + Upload ---------------- */
function setAvatarDisplay(publicUrl, fallbackText) {
  if (publicUrl && els.avatarImg) {
    els.avatarImg.src = publicUrl;
    els.avatarImg.classList.remove("hidden");
    els.avatarFallback?.classList.add("hidden");
  } else {
    els.avatarImg?.classList.add("hidden");
    els.avatarFallback?.classList.remove("hidden");
    if (els.avatarFallback) els.avatarFallback.textContent = fallbackText || "P";
  }
}

function ensureFilterUI() {
  // Inject filter controls into modal if not already present in HTML
  if (!$("brightRange")) {
    const row = document.createElement("div");
    row.className = "modalRow";
    row.style.marginTop = "10px";
    row.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;width:100%;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="muted">Brightness</span>
          <input id="brightRange" class="range" type="range" min="70" max="140" step="1" value="105" />
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="muted">Contrast</span>
          <input id="contrastRange" class="range" type="range" min="70" max="140" step="1" value="105" />
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="muted">Saturation</span>
          <input id="satRange" class="range" type="range" min="70" max="160" step="1" value="110" />
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;width:100%;margin-top:10px;">
        <button id="presetWarm" class="btnGhost" type="button">Warm</button>
        <button id="presetCool" class="btnGhost" type="button">Cool</button>
        <button id="presetBW" class="btnGhost" type="button">B&W</button>
        <button id="presetReset" class="btnGhost" type="button">Reset</button>
      </div>
    `;
    // insert just after zoom row
    const zoomRow = els.zoomRange?.closest(".modalRow");
    zoomRow?.parentNode?.insertBefore(row, zoomRow.nextSibling);
  }
}

let cropImg = null;
let imgW = 0, imgH = 0;
let offsetX = 0, offsetY = 0;
let zoom = 1.4;
let dragging = false;
let lastX = 0, lastY = 0;

function openCropModal() {
  if (!els.cropBack) return;
  ensureFilterUI();
  els.cropBack.classList.add("show");
  els.cropBack.setAttribute("aria-hidden", "false");
}
function closeCropModal() {
  if (!els.cropBack) return;
  els.cropBack.classList.remove("show");
  els.cropBack.setAttribute("aria-hidden", "true");
  dragging = false;
}

function getFilterString() {
  const b = Number($("brightRange")?.value || 105);
  const c = Number($("contrastRange")?.value || 105);
  const s = Number($("satRange")?.value || 110);
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function drawCrop() {
  if (!els.cropCanvas || !cropImg) return;
  const ctx = els.cropCanvas.getContext("2d");
  const cw = els.cropCanvas.width;
  const ch = els.cropCanvas.height;

  ctx.clearRect(0, 0, cw, ch);

  ctx.save();
  ctx.filter = getFilterString();

  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  ctx.drawImage(cropImg, x, y, drawW, drawH);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(31,111,134,.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, cw - 16, ch - 16);
  ctx.restore();
}

function pointerPos(ev){
  const rect = els.cropCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (els.cropCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (els.cropCanvas.height / rect.height);
  return { x, y };
}

async function uploadAvatarFromCanvas() {
  if (!currentUserId) throw new Error("Not logged in.");

  const blob = await new Promise((resolve) =>
    els.cropCanvas.toBlob(resolve, "image/webp", 0.92)
  );
  if (!blob) throw new Error("Could not create image.");

  const path = `${currentUserId}/avatar.webp`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/webp" });

  if (upErr) throw upErr;

  // Save ONLY path to DB (clean)
  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: path, updated_at: new Date().toISOString() })
    .eq("id", currentUserId);

  if (dbErr) throw dbErr;

  // Return public URL for immediate UI update
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || null;
}

function wireFilterButtons() {
  const bright = $("brightRange");
  const cont = $("contrastRange");
  const sat = $("satRange");

  const rerender = () => drawCrop();

  bright?.addEventListener("input", rerender);
  cont?.addEventListener("input", rerender);
  sat?.addEventListener("input", rerender);

  $("presetWarm")?.addEventListener("click", () => {
    if (bright) bright.value = "108";
    if (cont) cont.value = "108";
    if (sat) sat.value = "125";
    drawCrop();
  });
  $("presetCool")?.addEventListener("click", () => {
    if (bright) bright.value = "102";
    if (cont) cont.value = "106";
    if (sat) sat.value = "112";
    drawCrop();
  });
  $("presetBW")?.addEventListener("click", () => {
    if (bright) bright.value = "103";
    if (cont) cont.value = "112";
    if (sat) sat.value = "0"; // saturate(0%) gives B&W effect
    drawCrop();
  });
  $("presetReset")?.addEventListener("click", () => {
    if (bright) bright.value = "105";
    if (cont) cont.value = "105";
    if (sat) sat.value = "110";
    drawCrop();
  });
}

/* ---------------- DB load/save ---------------- */
async function fetchProfileRow(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, rank, nationality, bio, setup_complete, avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function loadProfessionalDetails() {
  const { data: det } = await supabase
    .from("professional_details")
    .select("summary, services, achievements")
    .eq("profile_id", currentUserId)
    .maybeSingle();

  if (els.proSummary) els.proSummary.value = det?.summary || "";
  if (els.proServices) els.proServices.value = linesToText(det?.services || []);
  if (els.proAchievements) els.proAchievements.value = linesToText(det?.achievements || []);

  const { data: exps } = await supabase
    .from("professional_experience")
    .select("company, position, start_date, end_date, currently_working, location, description, sort_order")
    .eq("profile_id", currentUserId)
    .order("sort_order", { ascending: true });

  expItems = (exps || []).map(x => ({ ...x, start_date: x.start_date || "", end_date: x.end_date || "" }));
  renderExperienceList();
}

async function loadCompanyDetails() {
  const { data: det } = await supabase
    .from("company_details")
    .select("what_we_are, mission, vision, core_values, services, achievements, total_workers")
    .eq("profile_id", currentUserId)
    .maybeSingle();

  if (els.coWhat) els.coWhat.value = det?.what_we_are || "";
  if (els.coMission) els.coMission.value = det?.mission || "";
  if (els.coVision) els.coVision.value = det?.vision || "";
  if (els.coValues) els.coValues.value = det?.core_values || "";
  if (els.coWorkers) els.coWorkers.value = (det?.total_workers ?? "") === null ? "" : String(det?.total_workers ?? "");
  if (els.coServices) els.coServices.value = linesToText(det?.services || []);
  if (els.coAchievements) els.coAchievements.value = linesToText(det?.achievements || []);
}

async function saveAbout() {
  let rankToSave = null;

  if (currentRole === "seafarer") {
    const v = (els.rankValue?.value || "").trim();
    if (v === "Other") rankToSave = (els.rankOther?.value || "").trim() || null;
    else rankToSave = v || null;
  } else {
    rankToSave = normalizeEditableValue(els.titleValue?.textContent || "");
  }

  const updates = {
    full_name: normalizeEditableValue(els.fullName?.textContent || ""),
    rank: rankToSave,
    nationality: normalizeEditableValue(els.nationality?.textContent || ""),
    bio: normalizeEditableValue(els.bio?.textContent || ""),
    updated_at: new Date().toISOString()
  };

  Object.keys(updates).forEach(k => updates[k] === null && delete updates[k]);

  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUserId);
  if (error) throw error;
}

async function saveProfessional() {
  const payload = {
    profile_id: currentUserId,
    summary: (els.proSummary?.value || "").trim() || null,
    services: textToLines(els.proServices?.value || ""),
    achievements: textToLines(els.proAchievements?.value || ""),
    updated_at: new Date().toISOString()
  };

  const { error: dErr } = await supabase.from("professional_details").upsert(payload, { onConflict: "profile_id" });
  if (dErr) throw dErr;

  const { error: delErr } = await supabase.from("professional_experience").delete().eq("profile_id", currentUserId);
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

async function saveCompany() {
  const workersVal = (els.coWorkers?.value || "").trim();
  const totalWorkers = workersVal === "" ? null : Number(workersVal);

  const payload = {
    profile_id: currentUserId,
    what_we_are: (els.coWhat?.value || "").trim() || null,
    mission: (els.coMission?.value || "").trim() || null,
    vision: (els.coVision?.value || "").trim() || null,
    core_values: (els.coValues?.value || "").trim() || null,
    services: textToLines(els.coServices?.value || ""),
    achievements: textToLines(els.coAchievements?.value || ""),
    total_workers: Number.isFinite(totalWorkers) ? totalWorkers : null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("company_details").upsert(payload, { onConflict: "profile_id" });
  if (error) throw error;
}

/* ---------------- Load Profile
---------------- */
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

  // about fill
  if (els.fullName) els.fullName.textContent = safeText(p.full_name);
  if (els.titleValue) els.titleValue.textContent = safeText(p.rank);
  if (els.nationality) els.nationality.textContent = safeText(p.nationality);
  if (els.bio) els.bio.textContent = safeText(p.bio);
  if (els.email) els.email.textContent = safeText(session.user.email);

  // header fill
  if (els.profileName) els.profileName.textContent = safeText(p.full_name, "Profile");
  if (els.miniTitle) els.miniTitle.textContent = safeText(p.rank);
  if (els.miniNationality) els.miniNationality.textContent = safeText(p.nationality);

  const initials = initialsFromName(p.full_name || session.user.email || "P");

  // Render avatar if saved
  if (p.avatar_url) {
    const { data } = supabase.storage.from("avatars").getPublicUrl(p.avatar_url);
    setAvatarDisplay(data?.publicUrl || null, initials);
  } else {
    setAvatarDisplay(null, initials);
  }

  // role-specific extra load
  if (currentRole === "professional") await loadProfessionalDetails();
  if (currentRole === "company") await loadCompanyDetails();

  setAboutEditable(false);
  setExperienceEditable(false);
}

/* ---------------- Wire Buttons ---------------- */
els.editAboutBtn?.addEventListener("click", () => setAboutEditable(true));
els.saveAboutBtn?.addEventListener("click", async () => {
  try {
    await saveAbout();
    setAboutEditable(false);
    await loadProfile();
  } catch (e) {
    console.error(e);
    alert("Save About failed: " + (e.message || "Unknown error"));
  }
});

els.editExpBtn?.addEventListener("click", () => {
  if (currentRole === "seafarer") return;
  setExperienceEditable(true);
});
els.saveExpBtn?.addEventListener("click", async () => {
  try {
    if (currentRole === "professional") await saveProfessional();
    if (currentRole === "company") await saveCompany();
    setExperienceEditable(false);
    await loadProfile();
  } catch (e) {
    console.error(e);
    alert("Save Experience failed: " + (e.message || "Unknown error"));
  }
});

els.addExpBtn?.addEventListener("click", () => {
  if (!expEdit) return;
  expItems.push(newExpItem());
  expItems.forEach((x, i) => x.sort_order = i);
  renderExperienceList();
});

/* ---------------- Wire Avatar ---------------- */
els.avatarBtn?.addEventListener("click", () => els.avatarFile?.click());

els.avatarFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // load into crop
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;

    // reset
    zoom = Number(els.zoomRange?.value || 1.4);
    offsetX = 0;
    offsetY = 0;

    openCropModal();
    wireFilterButtons();
    drawCrop();
  };
  img.src = url;
});

// zoom
els.zoomRange?.addEventListener("input", () => {
  zoom = Number(els.zoomRange.value || 1.4);
  drawCrop();
});

// drag to pan
els.cropCanvas?.addEventListener("pointerdown", (ev) => {
  if (!cropImg) return;
  dragging = true;
  const p = pointerPos(ev);
  lastX = p.x;
  lastY = p.y;
  els.cropCanvas.setPointerCapture(ev.pointerId);
});

els.cropCanvas?.addEventListener("pointermove", (ev) => {
  if (!dragging || !cropImg) return;
  const p = pointerPos(ev);
  offsetX += (p.x - lastX);
  offsetY += (p.y - lastY);
  lastX = p.x;
  lastY = p.y;
  drawCrop();
});

els.cropCanvas?.addEventListener("pointerup", () => { dragging = false; });

els.cropClose?.addEventListener("click", closeCropModal);
els.cropCancel?.addEventListener("click", closeCropModal);

els.cropSave?.addEventListener("click", async () => {
  try {
    const url = await uploadAvatarFromCanvas();
    const initials = els.avatarFallback?.textContent || "P";
    setAvatarDisplay(url, initials);
    closeCropModal();
  } catch (e) {
    console.error(e);
    alert("Avatar upload failed: " + (e.message || "Unknown error"));
  }
});

/* ---------------- Init ---------------- */
(function init(){
  wireTabs();
  wireRankCombo();
  loadProfile().catch(e => {
    console.error("Profile load error:", e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  });
})();
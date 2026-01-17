import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("setupForm"),
  saveBtn: $("saveBtn"),
  errorBox: $("errorBox"),

  accountType: $("accountType"),
  accountTypeOtherWrap: $("accountTypeOtherWrap"),
  accountTypeOther: $("accountTypeOther"),

  fullName: $("fullName"),
  dob: $("dob"),

  rankWrap: $("rankWrap"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),

  roleWrap: $("roleWrap"),
  roleSearch: $("roleSearch"),
  roleValue: $("roleValue"),
  roleList: $("roleList"),
  roleOtherWrap: $("roleOtherWrap"),
  roleOther: $("roleOther"),

  companyWrap: $("companyWrap"),
  companyName: $("companyName"),

  countrySearch: $("countrySearch"),
  countryValue: $("countryValue"),
  countryList: $("countryList"),

  dialSearch: $("dialSearch"),
  dialValue: $("dialValue"),
  dialList: $("dialList"),

  phoneInput: $("phoneInput"),
  bio: $("bio"),

  photoInput: $("photoInput"),
  removePhotoBtn: $("removePhotoBtn"),
  avatarPreview: $("avatarPreview"),
};

let currentUser = null;
let countries = [];

// Will be saved into profiles.avatar_url (path only)
let avatarPath = null;

/* ===================== DROPDOWNS ===================== */

/* Seafarer ship roles only */
const RANKS = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Fourth Officer / 4/O",
  "Deck Cadet / Trainee",

  "Bosun",
  "AB / Able Seaman",
  "OS / Ordinary Seaman",
  "Trainee AB",
  "Trainee OS",

  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Fifth Engineer / Junior Engineer",
  "Engine Cadet / Trainee",

  "Motorman",
  "Oiler",
  "Wiper",
  "Fitter",
  "Pumpman",

  "ETO / Electro-Technical Officer",
  "Electrician",

  "Cook / Messman",
  "Other"
];

/* Company / Institute and Maritime Professionals (non-seafarer) */
const ROLES = [
  // Company / Institute / Employer-type roles
  "Crewing / Manning Company",
  "Ship Management Company",
  "Ship Owner / Operator",
  "Training Institute",
  "Maritime Academy / College",
  "Marine Recruitment Agency",
  "Ship Chandling / Supplier",
  "Port / Terminal Company",
  "Classification Society",
  "Marine Insurance / P&I",
  "Shipyard / Repair",
  "Maritime Software / IT Company",
  "Logistics / Freight Forwarder",
  "Other",

  // Maritime Professional (shore / specialist)
  "Marine Superintendent",
  "Technical Superintendent",
  "Port Captain",
  "HSQE / QHSE Officer",
  "Marine Surveyor",
  "Auditor / Inspector",
  "DP / Simulator Instructor",
  "Crewing Manager",
  "Recruiter / Talent Acquisition",
  "Operations Manager",
  "Fleet Manager",
  "VTS Officer",
  "Port / Terminal Staff",
  "Immigration / Visa Agent",
  "Accounts / Finance",
  "IT / Product / Software",
  "Other"
];

/* ===================== UI HELPERS ===================== */
function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function showList(listEl){
  if (!listEl) return;
  listEl.classList.add("show");
  listEl.style.display = "block";
}
function hideList(listEl){
  if (!listEl) return;
  listEl.classList.remove("show");
  listEl.style.display = "";
}

function showError(msg){
  if (!els.errorBox) return;
  els.errorBox.style.display = "block";
  els.errorBox.textContent = msg || "Something went wrong.";
}
function clearError(){
  if (!els.errorBox) return;
  els.errorBox.style.display = "none";
  els.errorBox.textContent = "";
}

function isSeafarer(){ return (els.accountType?.value || "") === "seafarer"; }
function isCompanyOrProfessional(){
  const v = els.accountType?.value || "";
  return v === "employer" || v === "shore" || v === "other";
}

function normalizeAccountType(){
  const v = els.accountType?.value || "";
  if (v === "other") {
    const other = (els.accountTypeOther?.value || "").trim();
    return other ? other : "Other";
  }
  if (!v) return "";
  if (v === "employer") return "Company / Institute";
  if (v === "shore") return "Maritime Professional";
  if (v === "seafarer") return "Seafarer";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getRank(){
  const v = (els.rankValue?.value || "").trim();
  if (v === "Other") return (els.rankOther?.value || "").trim();
  return v;
}
function getRole(){
  const v = (els.roleValue?.value || "").trim();
  if (v === "Other") return (els.roleOther?.value || "").trim();
  return v;
}

function getNationality(){ return (els.countryValue?.value || "").trim(); }

function getPhone(){
  const dial = (els.dialValue?.value || "").trim();
  const num = (els.phoneInput?.value || "").trim();
  if (!num) return "";
  if (dial && !num.startsWith("+")) return `${dial} ${num}`;
  return num;
}

/* ===================== GENERIC COMBO ===================== */
function makeCombo({ comboName, inputEl, listEl, items, label, onPick }) {
  if (!inputEl || !listEl) return;
  const key = comboName;

  function render(list){
    listEl.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "comboEmpty";
      empty.textContent = "No results";
      listEl.appendChild(empty);
      return;
    }
    list.forEach((it) => {
      const row = document.createElement("div");
      row.className = "comboItem";
      row.innerHTML = label(it);
      row.addEventListener("click", () => {
        onPick(it);
        hideList(listEl);
      });
      listEl.appendChild(row);
    });
  }

  function filterNow(){
    const q = (inputEl.value || "").toLowerCase().trim();
    const filtered = !q
      ? items.slice(0, 200)
      : items.filter((it) => {
          const txt = (typeof it === "string" ? it : (it?.name || it?.dial_code || "")).toLowerCase();
          return txt.includes(q);
        }).slice(0, 200);
    render(filtered);
    showList(listEl);
  }

  inputEl.addEventListener("focus", filterNow);
  inputEl.addEventListener("input", filterNow);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`[data-combo="${key}"]`)) hideList(listEl);
  });

  render(items.slice(0, 120));
}

/* ===================== COUNTRIES ===================== */
async function loadCountries(){
  const res = await fetch("/data/countries.json", { cache: "no-store" });
  const json = await res.json();

  countries = (json || [])
    .map(c => ({
      name: c.name || c.country || c.Country || "",
      dial_code: c.dial_code || c.dialCode || c.dial || "",
      code: c.code || c.iso2 || c.iso || ""
    }))
    .filter(c => c.name);
}

/* ===================== AVATAR PREVIEW ===================== */
function setAvatarPreviewFromUrl(url){
  if (!els.avatarPreview) return;
  els.avatarPreview.innerHTML = "";
  els.avatarPreview.style.backgroundSize = "cover";
  els.avatarPreview.style.backgroundPosition = "center";
  els.avatarPreview.style.backgroundImage = url ? `url("${url}")` : "";
  if (!url) els.avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
}

/* ===================== MODERN CROP MODAL (Injected) ===================== */
let cropModal = null;
let cropCanvas = null;
let cropCtx = null;

let cropImg = null;
let imgW = 0, imgH = 0;

let zoom = 1.4;
let offsetX = 0, offsetY = 0;
let dragging = false;
let lastX = 0, lastY = 0;

let aspect = 1; // 1:1 default
let pendingBlob = null; // saved avatar blob ready to upload

function ensureCropModal(){
  if (cropModal) return;

  const style = document.createElement("style");
  style.textContent = `
    .pvModalBack{
      position:fixed; inset:0; z-index:99999;
      display:none; align-items:center; justify-content:center;
      padding:16px; background: rgba(3,10,14,.55);
      backdrop-filter: blur(6px);
    }
    .pvModalBack.show{display:flex}
    .pvModal{
      width:min(560px, 96vw);
      background: #fff;
      border-radius: 22px;
      box-shadow: 0 30px 100px rgba(0,0,0,.45);
      overflow:hidden;
      border: 1px solid rgba(0,0,0,.06);
    }
    .pvHead{
      display:flex; align-items:center; justify-content:space-between;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(31,111,134,.08), rgba(255,255,255,0));
    }
    .pvTitle{font-weight:800; letter-spacing:.2px}
    .pvClose{
      border:0; background: rgba(0,0,0,.06);
      width:38px; height:38px; border-radius:12px;
      cursor:pointer; font-size:18px;
    }
    .pvBody{padding: 12px 16px 16px}
    .pvCanvasWrap{
      border-radius:18px;
      background: #eef6fb;
      border: 1px solid rgba(31,111,134,.18);
      overflow:hidden;
    }
    .pvToolbar{
      display:flex; gap:10px; flex-wrap:wrap;
      justify-content:space-between;
      margin-top: 12px;
    }
    .pvGroup{display:flex; gap:8px; flex-wrap:wrap; align-items:center}
    .pvPill{
      border:1px solid rgba(0,0,0,.10);
      background: #fff;
      padding: 8px 10px;
      border-radius: 999px;
      cursor:pointer;
      font-weight:700;
      font-size: 13px;
    }
    .pvPill.active{
      background: rgba(31,111,134,.10);
      border-color: rgba(31,111,134,.30);
      color:#0b1b24;
    }
    .pvSliderRow{
      display:grid;
      grid-template-columns: 1fr;
      gap:10px;
      margin-top: 12px;
    }
    .pvSlider{
      display:flex; align-items:center; gap:10px;
      background: rgba(0,0,0,.03);
      border: 1px solid rgba(0,0,0,.06);
      padding: 10px 12px;
      border-radius: 16px;
    }
    .pvSlider .lbl{min-width:88px; font-weight:700; color:#334; font-size:13px}
    .pvSlider input[type="range"]{width:100%}
    .pvFoot{
      display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
      margin-top: 14px;
    }
    .pvBtn{
      border:0; cursor:pointer;
      padding: 10px 14px;
      border-radius: 14px;
      font-weight:800;
    }
    .pvGhost{background: rgba(0,0,0,.06)}
    .pvPrimary{background: #1F6F86; color:#fff}
  `;
  document.head.appendChild(style);

  const back = document.createElement("div");
  back.className = "pvModalBack";
  back.id = "pvCropBack";

  back.innerHTML = `
    <div class="pvModal" role="dialog" aria-modal="true">
      <div class="pvHead">
        <div class="pvTitle">Adjust your photo</div>
        <button class="pvClose" type="button" id="pvCropClose">✕</button>
      </div>

      <div class="pvBody">
        <div class="pvCanvasWrap">
          <canvas id="pvCropCanvas" width="520" height="520" style="display:block;width:100%;height:auto"></canvas>
        </div>

        <div class="pvToolbar">
          <div class="pvGroup">
            <button class="pvPill active" type="button" data-aspect="1">1:1</button>
            <button class="pvPill" type="button" data-aspect="0.8">4:5</button>
            <button class="pvPill" type="button" data-aspect="1.7778">16:9</button>
          </div>

          <div class="pvGroup">
            <button class="pvPill" type="button" id="pvPresetWarm">Warm</button>
            <button class="pvPill" type="button" id="pvPresetCool">Cool</button>
            <button class="pvPill" type="button" id="pvPresetBW">B&W</button>
            <button class="pvPill" type="button" id="pvPresetReset">Reset</button>
          </div>
        </div>

        <div class="pvSliderRow">
          <div class="pvSlider">
            <div class="lbl">Zoom</div>
            <input id="pvZoom" type="range" min="1" max="3" step="0.01" value="1.4" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Brightness</div>
            <input id="pvBright" type="range" min="70" max="140" step="1" value="105" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Contrast</div>
            <input id="pvContrast" type="range" min="70" max="140" step="1" value="105" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Saturation</div>
            <input id="pvSat" type="range" min="0" max="160" step="1" value="110" />
          </div>
        </div>

        <div class="pvFoot">
          <button class="pvBtn pvGhost" type="button" id="pvCancel">Cancel</button>
          <button class="pvBtn pvPrimary" type="button" id="pvSavePhoto">Use Photo</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(back);

  cropModal = back;
  cropCanvas = document.getElementById("pvCropCanvas");
  cropCtx = cropCanvas.getContext("2d");

  document.getElementById("pvCropClose").addEventListener("click", closeCrop);
  document.getElementById("pvCancel").addEventListener("click", closeCrop);

  // Aspect buttons
  back.querySelectorAll("[data-aspect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      back.querySelectorAll("[data-aspect]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      aspect = Number(btn.getAttribute("data-aspect") || "1");
      drawCrop();
    });
  });

  // Sliders
  const rerender = () => drawCrop();
  document.getElementById("pvZoom").addEventListener("input", (e) => {
    zoom = Number(e.target.value || 1.4);
    drawCrop();
  });
  document.getElementById("pvBright").addEventListener("input", rerender);
  document.getElementById("pvContrast").addEventListener("input", rerender);
  document.getElementById("pvSat").addEventListener("input", rerender);

  // Presets
  const bright = () => document.getElementById("pvBright");
  const cont = () => document.getElementById("pvContrast");
  const sat = () => document.getElementById("pvSat");

  document.getElementById("pvPresetWarm").addEventListener("click", () => {
    bright().value = "108";
    cont().value = "108";
    sat().value = "125";
    drawCrop();
  });
  document.getElementById("pvPresetCool").addEventListener("click", () => {
    bright().value = "102";
    cont().value = "106";
    sat().value = "112";
    drawCrop();
  });
  document.getElementById("pvPresetBW").addEventListener("click", () => {
    bright().value = "103";
    cont().value = "112";
    sat().value = "0";
    drawCrop();
  });
  document.getElementById("pvPresetReset").addEventListener("click", () => {
    document.getElementById("pvZoom").value = "1.4";
    zoom = 1.4;
    bright().value = "105";
    cont().value = "105";
    sat().value = "110";
    offsetX = 0;
    offsetY = 0;
    drawCrop();
  });

  // Save photo (creates blob; actual upload happens on profile save)
  document.getElementById("pvSavePhoto").addEventListener("click", async () => {
    try {
      pendingBlob = await exportCroppedWebpBlob();
      // Update preview immediately
      const url = URL.createObjectURL(pendingBlob);
      setAvatarPreviewFromUrl(url);
      closeCrop();
      validate();
    } catch (e) {
      console.error(e);
      showError("Could not apply photo. Please try another image.");
    }
  });

  // Drag to position
  cropCanvas.addEventListener("pointerdown", (ev) => {
    if (!cropImg) return;
    dragging = true;
    const p = pointerPos(ev);
    lastX = p.x;
    lastY = p.y;
    cropCanvas.setPointerCapture(ev.pointerId);
  });

  cropCanvas.addEventListener("pointermove", (ev) => {
    if (!dragging || !cropImg) return;
    const p = pointerPos(ev);
    offsetX += (p.x - lastX);
    offsetY += (p.y - lastY);
    lastX = p.x;
    lastY = p.y;
    drawCrop();
  });

  cropCanvas.addEventListener("pointerup", () => { dragging = false; });
  cropCanvas.addEventListener("pointercancel", () => { dragging = false; });
}

function openCropWithFile(file){
  ensureCropModal();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;

    // reset position for new image
    zoom = 1.4;
    offsetX = 0;
    offsetY = 0;
    dragging = false;

    document.getElementById("pvZoom").value = "1.4";
    cropModal.classList.add("show");
    drawCrop();
  };
  img.src = url;
}

function closeCrop(){
  if (!cropModal) return;
  cropModal.classList.remove("show");
}

function pointerPos(ev){
  const rect = cropCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (cropCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (cropCanvas.height / rect.height);
  return { x, y };
}

function getFilterString(){
  const b = Number(document.getElementById("pvBright")?.value || 105);
  const c = Number(document.getElementById("pvContrast")?.value || 105);
  const s = Number(document.getElementById("pvSat")?.value || 110);
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function drawCrop(){
  if (!cropCtx || !cropImg) return;

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  cropCtx.clearRect(0, 0, cw, ch);

  // Determine crop frame based on aspect ratio (centered)
  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;

  let frameW = frameMaxW;
  let frameH = frameW / aspect;

  if (frameH > frameMaxH) {
    frameH = frameMaxH;
    frameW = frameH * aspect;
  }

  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // Draw image behind
  cropCtx.save();
  cropCtx.filter = getFilterString();

  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  cropCtx.drawImage(cropImg, x, y, drawW, drawH);
  cropCtx.restore();

  // Dim outside frame
  cropCtx.save();
  cropCtx.fillStyle = "rgba(3,10,14,.45)";
  cropCtx.fillRect(0, 0, cw, ch);
  cropCtx.clearRect(frameX, frameY, frameW, frameH);
  cropCtx.restore();

  // Frame border
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(31,111,134,.95)";
  cropCtx.lineWidth = 3;
  cropCtx.strokeRect(frameX, frameY, frameW, frameH);
  cropCtx.restore();

  // subtle corners
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(255,255,255,.9)";
  cropCtx.lineWidth = 2;
  const corner = 18;
  // TL
  cropCtx.beginPath();
  cropCtx.moveTo(frameX, frameY + corner);
  cropCtx.lineTo(frameX, frameY);
  cropCtx.lineTo(frameX + corner, frameY);
  cropCtx.stroke();
  // TR
  cropCtx.beginPath();
  cropCtx.moveTo(frameX + frameW - corner, frameY);
  cropCtx.lineTo(frameX + frameW, frameY);
  cropCtx.lineTo(frameX + frameW, frameY + corner);
  cropCtx.stroke();
  // BL
  cropCtx.beginPath();
  cropCtx.moveTo(frameX, frameY + frameH - corner);
  cropCtx.lineTo(frameX, frameY + frameH);
  cropCtx.lineTo(frameX + corner, frameY + frameH);
  cropCtx.stroke();
  // BR
  cropCtx.beginPath();
  cropCtx.moveTo(frameX + frameW - corner, frameY + frameH);
  cropCtx.lineTo(frameX + frameW, frameY + frameH);
  cropCtx.lineTo(frameX + frameW, frameY + frameH - corner);
  cropCtx.stroke();
  cropCtx.restore();
}

async function exportCroppedWebpBlob(){
  if (!cropImg) throw new Error("No image");

  // Create output canvas as a square for avatar final (best for profile)
  // Even if user chooses 4:5 or 16:9, we’ll still export to avatar.webp in 1:1
  // BUT: you asked ratio selectable — for setup we respect it visually and export that frame ratio.
  const outW = 720;
  const outH = Math.round(outW / aspect);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");

  // Match the same frame used in drawCrop
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;

  let frameW = frameMaxW;
  let frameH = frameW / aspect;
  if (frameH > frameMaxH) { frameH = frameMaxH; frameW = frameH * aspect; }

  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // Recompute image draw rect on cropCanvas
  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  // We need to map the frame area to source image coordinates
  // Source area on cropCanvas that corresponds to frame:
  const sx = (frameX - x) / drawW * imgW;
  const sy = (frameY - y) / drawH * imgH;
  const sw = frameW / drawW * imgW;
  const sh = frameH / drawH * imgH;

  ctx.save();
  ctx.filter = getFilterString();
  ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, outW, outH);
  ctx.restore();

  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("Failed to export");
  return blob;
}

/* ===================== VALIDATION ===================== */
function validate(){
  clearError();

  const acct = els.accountType?.value || "";
  const acctOk = !!acct;
  const otherOk = acct !== "other" || ((els.accountTypeOther?.value || "").trim().length > 1);

  const nationalityOk = getNationality().length > 1;

  const rankOk = !isSeafarer() || getRank().length > 1;
  const rankOtherOk = !(isSeafarer() && (els.rankValue?.value === "Other")) || ((els.rankOther?.value || "").trim().length > 1);

  const roleOk = !isCompanyOrProfessional() || getRole().length > 1;
  const roleOtherOk = !(isCompanyOrProfessional() && (els.roleValue?.value === "Other")) || ((els.roleOther?.value || "").trim().length > 1);

  const ok = acctOk && otherOk && nationalityOk && rankOk && rankOtherOk && roleOk && roleOtherOk;

  if (els.saveBtn) els.saveBtn.disabled = !ok;
  return ok;
}

/* ===================== ACCOUNT UI SWITCH ===================== */
function syncAccountUI(){
  const acct = els.accountType?.value || "";

  if (acct === "other") show(els.accountTypeOtherWrap);
  else hide(els.accountTypeOtherWrap);

  if (acct === "seafarer") show(els.rankWrap);
  else hide(els.rankWrap);

  // employer + shore + other use ROLE dropdown (company/institute/professional)
  if (acct === "employer" || acct === "shore" || acct === "other") {
    show(els.roleWrap);
    show(els.companyWrap);
  } else {
    hide(els.roleWrap);
    hide(els.companyWrap);
  }

  validate();
}

/* ===================== UPLOAD AVATAR (Storage + DB path) ===================== */
async function uploadAvatarIfAny(){
  if (!pendingBlob) return null;
  if (!currentUser?.id) return null;

  const path = `${currentUser.id}/avatar.webp`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, pendingBlob, { upsert: true, contentType: "image/webp" });

  if (upErr) throw upErr;

  avatarPath = path;
  return path;
}

/* ===================== SAVE PROFILE ===================== */
async function saveProfile(){
  if (!validate()) {
    showError("Please complete the required fields (Account type, Nationality, Role).");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";

  try {
    // Upload avatar first (if user selected)
    await uploadAvatarIfAny();

    const payload = {
      id: currentUser.id,
      account_type: normalizeAccountType(),
      full_name: (els.fullName?.value || "").trim(),
      dob: els.dob?.value || null,

      rank: isSeafarer() ? getRank() : null,

      // company/professional fields
      role: isCompanyOrProfessional() ? getRole() : null,
      company_name: isCompanyOrProfessional() ? (els.companyName?.value || "").trim() : null,

      nationality: getNationality(),
      phone: getPhone(),
      bio: (els.bio?.value || "").trim(),

      avatar_url: avatarPath, // path only
      setup_complete: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    window.location.href = "/dashboard/index.html";
  } catch (e) {
    console.error("SAVE ERROR:", e);
    showError(`Save failed: ${e.message || "Unknown error"}`);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
  }
}

/* ===================== INIT ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  await loadCountries();

  // Rank combo
  makeCombo({
    comboName: "rank",
    inputEl: els.rankSearch,
    listEl: els.rankList,
    items: RANKS,
    label: (r) => `<strong>${r}</strong>`,
    onPick: (r) => {
      els.rankSearch.value = r;
      els.rankValue.value = r;
      if (r === "Other") show(els.rankOtherWrap); else hide(els.rankOtherWrap);
      validate();
    }
  });

  // Role combo (company/professional)
  makeCombo({
    comboName: "role",
    inputEl: els.roleSearch,
    listEl: els.roleList,
    items: ROLES,
    label: (r) => `<strong>${r}</strong>`,
    onPick: (r) => {
      els.roleSearch.value = r;
      els.roleValue.value = r;
      if (r === "Other") show(els.roleOtherWrap); else hide(els.roleOtherWrap);
      validate();
    }
  });

  // Country combo
  makeCombo({
    comboName: "country",
    inputEl: els.countrySearch,
    listEl: els.countryList,
    items: countries,
    label: (c) => `<strong>${c.name}</strong>`,
    onPick: (c) => {
      els.countrySearch.value = c.name;
      els.countryValue.value = c.name;
      if (c.dial_code) {
        els.dialSearch.value = c.dial_code;
        els.dialValue.value = c.dial_code;
      }
      validate();
    }
  });

  // Dial combo
  makeCombo({
    comboName: "dial",
    inputEl: els.dialSearch,
    listEl: els.dialList,
    items: countries.filter(c => c.dial_code),
    label: (c) => `<strong>${c.dial_code}</strong> <span class="muted">— ${c.name}</span>`,
    onPick: (c) => {
      els.dialSearch.value = c.dial_code;
      els.dialValue.value = c.dial_code;
      validate();
    }
  });

  // Avatar: open crop modal on select
  els.photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropWithFile(file);
  });

  els.removePhotoBtn?.addEventListener("click", () => {
    pendingBlob = null;
    avatarPath = null;
    if (els.photoInput) els.photoInput.value = "";
    setAvatarPreviewFromUrl(null);
    validate();
  });

  // Events
  els.accountType?.addEventListener("change", syncAccountUI);
  els.accountTypeOther?.addEventListener("input", validate);
  els.rankOther?.addEventListener("input", validate);
  els.roleOther?.addEventListener("input", validate);
  els.companyName?.addEventListener("input", validate);
  els.countrySearch?.addEventListener("input", validate);
  els.dialSearch?.addEventListener("input", () => {
    els.dialValue.value = (els.dialSearch.value || "").trim();
    validate();
  });
  els.phoneInput?.addEventListener("input", validate);
  els.bio?.addEventListener("input", validate);
  els.fullName?.addEventListener("input", validate);
  els.dob?.addEventListener("change", validate);

  // Save
  els.form?.addEventListener("submit", (e) => { e.preventDefault(); saveProfile(); });
  els.saveBtn?.addEventListener("click", (e) => { e.preventDefault(); saveProfile(); });

  // initial
  syncAccountUI();
  validate();
});
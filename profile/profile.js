import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const $ = (id) => document.getElementById(id);

const els = {
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

  fullName: $("fullName"),
  email: $("email"),
  titleValue: $("titleValue"),
  nationality: $("nationality"),
  bio: $("bio"),

  editAboutBtn: $("editAboutBtn"),
  saveAboutBtn: $("saveAboutBtn"),

  editExpBtn: $("editExpBtn"),
  saveExpBtn: $("saveExpBtn"),

  rankEditWrap: $("rankEditWrap"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),

  proExpWrap: $("proExpWrap"),
  proSummary: $("proSummary"),
  proServices: $("proServices"),
  proAchievements: $("proAchievements"),
  addExpBtn: $("addExpBtn"),
  expList: $("expList"),

  companyWrap: $("companyWrap"),
  coWhat: $("coWhat"),
  coMission: $("coMission"),
  coVision: $("coVision"),
  coValues: $("coValues"),
  coWorkers: $("coWorkers"),
  coServices: $("coServices"),
  coAchievements: $("coAchievements"),

  avatarBtn: $("avatarBtn"),
  avatarImg: $("avatarImg"),
  avatarFallback: $("avatarFallback"),
  avatarFile: $("avatarFile"),

  cropBack: $("cropBack"),
  cropClose: $("cropClose"),
  cropCancel: $("cropCancel"),
  cropSave: $("cropSave"),
  cropCanvas: $("cropCanvas"),
  zoomRange: $("zoomRange"),

  ratio11: $("ratio11"),
  ratio45: $("ratio45"),
  ratio169: $("ratio169"),

  brightRange: $("brightRange"),
  contrastRange: $("contrastRange"),
  satRange: $("satRange"),
  presetWarm: $("presetWarm"),
  presetCool: $("presetCool"),
  presetBW: $("presetBW"),
  presetReset: $("presetReset"),
};

let currentUserId = null;
let currentRole = "seafarer";
let aboutEdit = false;
let expEdit = false;
let expItems = [];

/* Ship roles only */
const SEAFARER_RANKS = [
  "Master / Captain","Chief Officer / C/O","Second Officer / 2/O","Third Officer / 3/O","Fourth Officer / 4/O",
  "Deck Cadet / Trainee","Bosun","AB / Able Seaman","OS / Ordinary Seaman","Pumpman","Fitter","Cook / Messman",
  "Chief Engineer","Second Engineer","Third Engineer","Fourth Engineer","Fifth Engineer / Junior Engineer",
  "Engine Cadet / Trainee","Motorman","Oiler","Wiper","ETO / Electro-Technical Officer","Electrician","Other"
];

function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function safeText(v, fallback = "—"){
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}
function normalizeEditableValue(v){
  const t = (v ?? "").toString().trim();
  if (!t || t === "—") return null;
  return t;
}
function initialsFromName(name){
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const first = parts[0][0] || "";
  const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
  return (first + last).toUpperCase() || "P";
}
function roleLabel(role){
  if (role === "company") return "Company / Institute";
  if (role === "professional") return "Maritime Professional";
  return "Seafarer";
}
function titleLabelForRole(role){
  if (role === "company") return "Company type";
  if (role === "professional") return "Professional role";
  return "Ship role";
}
function aboutTitleForRole(role){
  if (role === "company") return "Company profile";
  if (role === "professional") return "Professional profile";
  return "Seafarer profile";
}
function expTitleForRole(role){
  if (role === "company") return "Company profile";
  if (role === "professional") return "Experience";
  return "Experience";
}

function textToLines(t){ return (t||"").split("\n").map(x=>x.trim()).filter(Boolean); }
function linesToText(arr){ return (arr||[]).join("\n"); }

/* Tabs */
function wireTabs(){
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  tabs.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
}
function switchTab(name){
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const panes = ["about","posts","documents","experience","sea"].map(x => document.getElementById(`tab_${x}`));
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  panes.forEach(p => p && p.classList.toggle("hidden", p.id !== `tab_${name}`));
}

/* Rank combo */
function showList(listEl){ listEl && listEl.classList.add("show"); }
function hideList(listEl){ listEl && listEl.classList.remove("show"); }
function renderRankList(items){
  if (!els.rankList) return;
  els.rankList.innerHTML = "";
  if (!items.length){
    const empty = document.createElement("div");
    empty.className = "comboEmpty";
    empty.textContent = "No results";
    els.rankList.appendChild(empty);
    return;
  }
  items.forEach((r)=>{
    const row = document.createElement("div");
    row.className = "comboItem";
    row.innerHTML = `<strong>${r}</strong>`;
    row.addEventListener("click", ()=>{
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

  const filterNow = ()=>{
    const q = (els.rankSearch.value || "").toLowerCase().trim();
    const filtered = !q ? SEAFARER_RANKS.slice(0,200) : SEAFARER_RANKS.filter(r=>r.toLowerCase().includes(q)).slice(0,200);
    renderRankList(filtered);
    showList(els.rankList);
  };

  els.rankSearch.addEventListener("focus", filterNow);
  els.rankSearch.addEventListener("input", filterNow);

  document.addEventListener("click", (e)=>{
    if (!e.target.closest(`[data-combo="rank"]`)) hideList(els.rankList);
  });

  renderRankList(SEAFARER_RANKS.slice(0,120));
}

/* Role UI */
function applyRoleUI(role){
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

  // Rank dropdown only when editing + seafarer
  if (els.rankEditWrap) els.rankEditWrap.classList.toggle("hidden", !(isSeafarer && aboutEdit));
}

/* About edit */
function setAboutEditable(state){
  aboutEdit = state;

  [els.fullName, els.nationality, els.bio].forEach(el=>{
    if (!el) return;
    el.contentEditable = state;
    el.style.background = state ? "#eef6fb" : "";
  });

  const isSeafarer = currentRole === "seafarer";

  if (els.titleValue){
    if (isSeafarer){
      els.titleValue.contentEditable = false;
      els.titleValue.style.background = "";

      if (els.rankEditWrap) els.rankEditWrap.classList.toggle("hidden", !state);

      if (state){
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

/* Avatar crop (modern + ratio + filters) */
let cropImg = null;
let imgW = 0, imgH = 0;
let offsetX = 0, offsetY = 0;
let zoom = 1.45;
let dragging = false;
let lastX = 0, lastY = 0;

let cropRatio = 1; // 1:1 default
function setRatio(r){
  cropRatio = r;
  els.ratio11?.classList.toggle("active", r === 1);
  els.ratio45?.classList.toggle("active", r === 4/5);
  els.ratio169?.classList.toggle("active", r === 16/9);

  // Adjust canvas size to feel right for selected ratio
  const base = 420;
  if (!els.cropCanvas) return;
  const w = base;
  const h = Math.round(base / r);
  els.cropCanvas.width = w;
  els.cropCanvas.height = h;
  drawCrop();
}

function openCropModal(){
  els.cropBack?.classList.add("show");
  els.cropBack?.setAttribute("aria-hidden","false");
}
function closeCropModal(){
  els.cropBack?.classList.remove("show");
  els.cropBack?.setAttribute("aria-hidden","true");
  dragging = false;
  if (els.avatarFile) els.avatarFile.value = "";
}

function getFilterString(){
  const b = Number(els.brightRange?.value || 105);
  const c = Number(els.contrastRange?.value || 105);
  const s = Number(els.satRange?.value || 110);
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function drawCrop(){
  if (!els.cropCanvas || !cropImg) return;
  const ctx = els.cropCanvas.getContext("2d");
  const cw = els.cropCanvas.width;
  const ch = els.cropCanvas.height;

  // background
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle = "#f1f6fb";
  ctx.fillRect(0,0,cw,ch);

  // image
  ctx.save();
  ctx.filter = getFilterString();

  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW)/2 + offsetX;
  const y = (ch - drawH)/2 + offsetY;
  ctx.drawImage(cropImg, x, y, drawW, drawH);
  ctx.restore();

  // modern frame
  ctx.save();
  ctx.strokeStyle = "rgba(31,111,134,.95)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(31,111,134,.22)";
  ctx.shadowBlur = 18;
  ctx.strokeRect(10,10,cw-20,ch-20);
  ctx.restore();

  // soft vignette
  ctx.save();
  const grd = ctx.createLinearGradient(0,0,0,ch);
  grd.addColorStop(0,"rgba(0,0,0,.06)");
  grd.addColorStop(1,"rgba(0,0,0,.10)");
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,cw,ch);
  ctx.restore();
}

function pointerPos(ev){
  const rect = els.cropCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (els.cropCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (els.cropCanvas.height / rect.height);
  return { x, y };
}

async function exportAvatarBlob(){
  // We save avatar as square always (best for circle avatar)
  // If user chose 4:5 or 16:9, we center-crop to square before saving.
  const srcCanvas = els.cropCanvas;
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  // Create final square canvas 512x512
  const out = document.createElement("canvas");
  out.width = 512; out.height = 512;
  const ctx = out.getContext("2d");

  // Determine source square crop from current canvas
  const side = Math.min(w, h);
  const sx = Math.round((w - side) / 2);
  const sy = Math.round((h - side) / 2);

  ctx.drawImage(srcCanvas, sx, sy, side, side, 0, 0, 512, 512);

  const blob = await new Promise((resolve)=> out.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("Could not create image.");
  return blob;
}

async function uploadAvatar(){
  if (!currentUserId) throw new Error("Not logged in.");
  const blob = await exportAvatarBlob();

  const path = `${currentUserId}/avatar.webp`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, blob, { upsert:true, contentType:"image/webp" });

  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: path, updated_at: new Date().toISOString() })
    .eq("id", currentUserId);

  if (dbErr) throw dbErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || null;
}

function setAvatarDisplay(publicUrl, fallbackText){
  if (publicUrl && els.avatarImg){
    els.avatarImg.src = publicUrl;
    els.avatarImg.classList.remove("hidden");
    els.avatarFallback?.classList.add("hidden");
  } else {
    els.avatarImg?.classList.add("hidden");
    els.avatarFallback?.classList.remove("hidden");
    if (els.avatarFallback) els.avatarFallback.textContent = fallbackText || "P";
  }
}

/* DB */
async function fetchProfileRow(userId){
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, rank, nationality, bio, setup_complete, avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function saveAbout(){
  let rankToSave = null;

  if (currentRole === "seafarer"){
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

  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUserId);
  if (error) throw error;
}

/* Load */
async function loadProfile(){
  const session = await requireAuth();
  if (!session) return;

  const me = await getMyProfile(session.user.id);
  if (!me || me.setup_complete !== true){
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  currentUserId = session.user.id;

  const p = await fetchProfileRow(currentUserId);
  applyRoleUI(p.role);

  if (els.fullName) els.fullName.textContent = safeText(p.full_name);
  if (els.titleValue) els.titleValue.textContent = safeText(p.rank);
  if (els.nationality) els.nationality.textContent = safeText(p.nationality);
  if (els.bio) els.bio.textContent = safeText(p.bio);
  if (els.email) els.email.textContent = safeText(session.user.email);

  if (els.profileName) els.profileName.textContent = safeText(p.full_name, "Profile");
  if (els.miniTitle) els.miniTitle.textContent = safeText(p.rank);
  if (els.miniNationality) els.miniNationality.textContent = safeText(p.nationality);

  const initials = initialsFromName(p.full_name || session.user.email || "P");

  if (p.avatar_url){
    const { data } = supabase.storage.from("avatars").getPublicUrl(p.avatar_url);
    setAvatarDisplay(data?.publicUrl || null, initials);
  } else {
    setAvatarDisplay(null, initials);
  }

  setAboutEditable(false);
}

/* Wire */
els.editAboutBtn?.addEventListener("click", ()=> setAboutEditable(true));
els.saveAboutBtn?.addEventListener("click", async ()=>{
  try{
    await saveAbout();
    setAboutEditable(false);
    await loadProfile();
  }catch(e){
    console.error(e);
    alert("Save failed: " + (e.message || "Unknown error"));
  }
});

els.avatarBtn?.addEventListener("click", ()=> els.avatarFile?.click());

els.avatarFile?.addEventListener("change", (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = ()=>{
    cropImg = img;
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;

    offsetX = 0;
    offsetY = 0;
    zoom = Number(els.zoomRange?.value || 1.45);

    // default ratio
    setRatio(1);

    openCropModal();
    drawCrop();
  };
  img.src = url;
});

els.zoomRange?.addEventListener("input", ()=>{
  zoom = Number(els.zoomRange.value || 1.45);
  drawCrop();
});

// ratio buttons
els.ratio11?.addEventListener("click", ()=> setRatio(1));
els.ratio45?.addEventListener("click", ()=> setRatio(4/5));
els.ratio169?.addEventListener("click", ()=> setRatio(16/9));

// filters
const re = ()=> drawCrop();
els.brightRange?.addEventListener("input", re);
els.contrastRange?.addEventListener("input", re);
els.satRange?.addEventListener("input", re);

els.presetWarm?.addEventListener("click", ()=>{
  els.brightRange.value = "108";
  els.contrastRange.value = "108";
  els.satRange.value = "125";
  drawCrop();
});
els.presetCool?.addEventListener("click", ()=>{
  els.brightRange.value = "102";
  els.contrastRange.value = "106";
  els.satRange.value = "112";
  drawCrop();
});
els.presetBW?.addEventListener("click", ()=>{
  els.brightRange.value = "103";
  els.contrastRange.value = "112";
  els.satRange.value = "0";
  drawCrop();
});
els.presetReset?.addEventListener("click", ()=>{
  els.brightRange.value = "105";
  els.contrastRange.value = "105";
  els.satRange.value = "110";
  drawCrop();
});

els.cropClose?.addEventListener("click", closeCropModal);
els.cropCancel?.addEventListener("click", closeCropModal);

els.cropCanvas?.addEventListener("pointerdown", (ev)=>{
  if (!cropImg) return;
  dragging = true;
  const p = pointerPos(ev);
  lastX = p.x; lastY = p.y;
  els.cropCanvas.setPointerCapture(ev.pointerId);
});
els.cropCanvas?.addEventListener("pointermove", (ev)=>{
  if (!dragging || !cropImg) return;
  const p = pointerPos(ev);
  offsetX += (p.x - lastX);
  offsetY += (p.y - lastY);
  lastX = p.x; lastY = p.y;
  drawCrop();
});
els.cropCanvas?.addEventListener("pointerup", ()=> dragging = false);

els.cropSave?.addEventListener("click", async ()=>{
  try{
    const url = await uploadAvatar();
    const initials = els.avatarFallback?.textContent || "P";
    setAvatarDisplay(url, initials);
    closeCropModal();
  }catch(e){
    console.error(e);
    alert("Avatar upload failed: " + (e.message || "Unknown error"));
  }
});

/* Init */
(function init(){
  wireTabs();
  wireRankCombo();
  loadProfile().catch(e=>{
    console.error(e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  });
})();
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

/* -------------------- helpers -------------------- */
function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }
function setText(id, txt) {
  const el = $(id);
  if (el) el.textContent = (txt ?? "").toString();
}

function initialsFromName(name) {
  const s = (name || "").trim();
  if (!s) return "P";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "P";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function normalizeTypeLabel(accountTypeRaw) {
  const t = (accountTypeRaw || "").toLowerCase();
  if (t.includes("seafarer")) return "Seafarer";
  if (t.includes("company") || t.includes("institute") || t.includes("employer")) return "Company / Institute";
  if (t.includes("professional") || t.includes("shore")) return "Maritime Professional";
  return accountTypeRaw || "Profile";
}

function typeKey(accountTypeRaw) {
  const t = (accountTypeRaw || "").toLowerCase();
  if (t.includes("seafarer")) return "seafarer";
  if (t.includes("company") || t.includes("institute") || t.includes("employer")) return "company";
  if (t.includes("professional") || t.includes("shore")) return "professional";
  return "other";
}

/* -------------------- elements -------------------- */
const els = {
  avatarBtn: $("avatarBtn"),
  avatarImg: $("avatarImg"),
  avatarFallback: $("avatarFallback"),
  avatarFile: $("avatarFile"),

  profileName: $("profileName"),
  typeBadge: $("typeBadge"),
  miniTitleLabel: $("miniTitleLabel"),
  miniTitle: $("miniTitle"),
  miniNationality: $("miniNationality"),

  aboutTitle: $("aboutTitle"),
  titleLabel: $("titleLabel"),
  titleValue: $("titleValue"),

  fullName: $("fullName"),
  email: $("email"),
  nationality: $("nationality"),
  bio: $("bio"),

  editAboutBtn: $("editAboutBtn"),
  saveAboutBtn: $("saveAboutBtn"),

  // optional seafarer dropdown area exists in your home.html
  rankEditWrap: $("rankEditWrap"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),
};

/* -------------------- state -------------------- */
let currentUser = null;
let currentProfile = null;

/* -------------------- avatar menu (B) -------------------- */
let avatarMenuEl = null;

function closeAvatarMenu() {
  if (!avatarMenuEl) return;
  avatarMenuEl.remove();
  avatarMenuEl = null;
  document.removeEventListener("click", onDocClickCloseMenu, true);
}
function onDocClickCloseMenu(e) {
  if (!avatarMenuEl) return;
  if (avatarMenuEl.contains(e.target)) return;
  if (els.avatarBtn && els.avatarBtn.contains(e.target)) return;
  closeAvatarMenu();
}

function openAvatarMenu() {
  closeAvatarMenu();
  if (!els.avatarBtn) return;

  const r = els.avatarBtn.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.style.position = "fixed";
  menu.style.zIndex = "99999";
  menu.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, r.left))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 160, r.bottom + 8)}px`;
  menu.style.width = "210px";
  menu.style.background = "#fff";
  menu.style.border = "1px solid rgba(0,0,0,.10)";
  menu.style.borderRadius = "16px";
  menu.style.boxShadow = "0 18px 60px rgba(0,0,0,.22)";
  menu.style.overflow = "hidden";

  const item = (label, danger = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.width = "100%";
    b.style.textAlign = "left";
    b.style.border = "0";
    b.style.background = "transparent";
    b.style.padding = "12px 14px";
    b.style.cursor = "pointer";
    b.style.fontWeight = "800";
    b.style.fontSize = "14px";
    b.style.color = danger ? "#b42318" : "#0b1b24";
    b.addEventListener("click", () => {});
    b.addEventListener("mouseover", () => (b.style.background = "rgba(31,111,134,.08)"));
    b.addEventListener("mouseout", () => (b.style.background = "transparent"));
    return b;
  };

  const changeBtn = item("Change photo");
  changeBtn.addEventListener("click", () => {
    closeAvatarMenu();
    els.avatarFile?.click();
  });

  const removeBtn = item("Remove photo", true);
  removeBtn.addEventListener("click", async () => {
    closeAvatarMenu();
    await removeAvatar();
  });

  menu.appendChild(changeBtn);
  menu.appendChild(removeBtn);

  avatarMenuEl = menu;
  document.body.appendChild(menu);

  // close on outside click
  setTimeout(() => document.addEventListener("click", onDocClickCloseMenu, true), 0);
}

/* -------------------- modern crop modal (same as setup) -------------------- */
let cropBack = null, cropCanvas = null, cropCtx = null;
let cropImg = null, imgW = 0, imgH = 0;
let zoom = 1.4, offsetX = 0, offsetY = 0;
let dragging = false, lastX = 0, lastY = 0;
let aspect = 1; // 1:1 default
let pendingBlob = null; // webp blob ready to upload

function ensureCropModal() {
  if (cropBack) return;

  const style = document.createElement("style");
  style.textContent = `
    .pvModalBack{
      position:fixed; inset:0; z-index:999999;
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
    .pvTitle{font-weight:900; letter-spacing:.2px}
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
      font-weight:900;
      font-size: 13px;
    }
    .pvPill.active{
      background: rgba(31,111,134,.10);
      border-color: rgba(31,111,134,.30);
      color:#0b1b24;
    }
    .pvSliderRow{display:grid; grid-template-columns:1fr; gap:10px; margin-top: 12px;}
    .pvSlider{
      display:flex; align-items:center; gap:10px;
      background: rgba(0,0,0,.03);
      border: 1px solid rgba(0,0,0,.06);
      padding: 10px 12px;
      border-radius: 16px;
    }
    .pvSlider .lbl{min-width:88px; font-weight:900; color:#334; font-size:13px}
    .pvSlider input[type="range"]{width:100%}
    .pvFoot{display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top: 14px;}
    .pvBtn{border:0; cursor:pointer; padding: 10px 14px; border-radius: 14px; font-weight:900;}
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

  cropBack = back;
  cropCanvas = document.getElementById("pvCropCanvas");
  cropCtx = cropCanvas.getContext("2d");

  const close = () => cropBack.classList.remove("show");
  document.getElementById("pvCropClose").addEventListener("click", close);
  document.getElementById("pvCancel").addEventListener("click", close);

  back.querySelectorAll("[data-aspect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      back.querySelectorAll("[data-aspect]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      aspect = Number(btn.getAttribute("data-aspect") || "1");
      drawCrop();
    });
  });

  document.getElementById("pvZoom").addEventListener("input", (e) => {
    zoom = Number(e.target.value || 1.4);
    drawCrop();
  });

  const rerender = () => drawCrop();
  document.getElementById("pvBright").addEventListener("input", rerender);
  document.getElementById("pvContrast").addEventListener("input", rerender);
  document.getElementById("pvSat").addEventListener("input", rerender);

  const bright = () => document.getElementById("pvBright");
  const cont = () => document.getElementById("pvContrast");
  const sat = () => document.getElementById("pvSat");

  document.getElementById("pvPresetWarm").addEventListener("click", () => {
    bright().value = "108"; cont().value = "108"; sat().value = "125"; drawCrop();
  });
  document.getElementById("pvPresetCool").addEventListener("click", () => {
    bright().value = "102"; cont().value = "106"; sat().value = "112"; drawCrop();
  });
  document.getElementById("pvPresetBW").addEventListener("click", () => {
    bright().value = "103"; cont().value = "112"; sat().value = "0"; drawCrop();
  });
  document.getElementById("pvPresetReset").addEventListener("click", () => {
    document.getElementById("pvZoom").value = "1.4";
    zoom = 1.4;
    bright().value = "105"; cont().value = "105"; sat().value = "110";
    offsetX = 0; offsetY = 0;
    drawCrop();
  });

  document.getElementById("pvSavePhoto").addEventListener("click", async () => {
    try {
      pendingBlob = await exportCroppedWebpBlob();
      cropBack.classList.remove("show");
      await saveAvatarToSupabase(); // upload + update profile
    } catch (e) {
      console.error(e);
      alert("Could not apply photo. Please try another image.");
    }
  });

  cropCanvas.addEventListener("pointerdown", (ev) => {
    if (!cropImg) return;
    dragging = true;
    const p = pointerPos(ev);
    lastX = p.x; lastY = p.y;
    cropCanvas.setPointerCapture(ev.pointerId);
  });
  cropCanvas.addEventListener("pointermove", (ev) => {
    if (!dragging || !cropImg) return;
    const p = pointerPos(ev);
    offsetX += (p.x - lastX);
    offsetY += (p.y - lastY);
    lastX = p.x; lastY = p.y;
    drawCrop();
  });
  cropCanvas.addEventListener("pointerup", () => { dragging = false; });
  cropCanvas.addEventListener("pointercancel", () => { dragging = false; });
}

function pointerPos(ev) {
  const rect = cropCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (cropCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (cropCanvas.height / rect.height);
  return { x, y };
}

function getFilterString() {
  const b = Number(document.getElementById("pvBright")?.value || 105);
  const c = Number(document.getElementById("pvContrast")?.value || 105);
  const s = Number(document.getElementById("pvSat")?.value || 110);
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function openCropWithFile(file) {
  ensureCropModal();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;

    zoom = 1.4;
    offsetX = 0;
    offsetY = 0;
    dragging = false;

    document.getElementById("pvZoom").value = "1.4";
    cropBack.classList.add("show");
    drawCrop();
  };
  img.src = url;
}

/* IMPORTANT: overlay drawn around frame (does not wipe image) */
function drawCrop() {
  if (!cropCtx || !cropImg) return;

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  cropCtx.clearRect(0, 0, cw, ch);

  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;

  let frameW = frameMaxW;
  let frameH = frameW / aspect;
  if (frameH > frameMaxH) { frameH = frameMaxH; frameW = frameH * aspect; }

  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // draw image
  cropCtx.save();
  cropCtx.filter = getFilterString();

  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  cropCtx.drawImage(cropImg, x, y, drawW, drawH);
  cropCtx.restore();

  // overlay outside frame
  cropCtx.save();
  cropCtx.fillStyle = "rgba(3,10,14,.45)";
  cropCtx.fillRect(0, 0, cw, frameY);
  cropCtx.fillRect(0, frameY + frameH, cw, ch - (frameY + frameH));
  cropCtx.fillRect(0, frameY, frameX, frameH);
  cropCtx.fillRect(frameX + frameW, frameY, cw - (frameX + frameW), frameH);
  cropCtx.restore();

  // frame border
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(31,111,134,.95)";
  cropCtx.lineWidth = 3;
  cropCtx.strokeRect(frameX, frameY, frameW, frameH);
  cropCtx.restore();
}

async function exportCroppedWebpBlob() {
  if (!cropImg) throw new Error("No image");

  const outW = 720;
  const outH = Math.round(outW / aspect);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");

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

  const drawW = imgW * zoom;
  const drawH = imgH * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  // source rect inside the original image
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

/* -------------------- supabase avatar save/remove -------------------- */
async function saveAvatarToSupabase() {
  if (!pendingBlob || !currentUser?.id) return;

  const path = `${currentUser.id}/avatar.webp`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, pendingBlob, { upsert: true, contentType: "image/webp" });

  if (upErr) {
    console.error(upErr);
    alert(`Upload failed: ${upErr.message}`);
    return;
  }

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: path, updated_at: new Date().toISOString() })
    .eq("id", currentUser.id);

  if (dbErr) {
    console.error(dbErr);
    alert(`Save failed: ${dbErr.message}`);
    return;
  }

  // reflect immediately
  currentProfile = { ...(currentProfile || {}), avatar_url: path };
  renderAvatar(currentProfile);
}

async function removeAvatar() {
  if (!currentUser?.id) return;

  try {
    // remove file if exists
    const path = `${currentUser.id}/avatar.webp`;
    await supabase.storage.from("avatars").remove([path]);

    // update profile
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", currentUser.id);

    if (error) throw error;

    currentProfile = { ...(currentProfile || {}), avatar_url: null };
    renderAvatar(currentProfile);
  } catch (e) {
    console.error(e);
    alert(`Remove failed: ${e.message || "Unknown error"}`);
  }
}

/* -------------------- render avatar -------------------- */
function renderAvatar(profile) {
  const name = profile?.full_name || "";
  const initials = initialsFromName(name);

  if (els.avatarFallback) els.avatarFallback.textContent = initials;

  const path = profile?.avatar_url;
  if (!path) {
    hide(els.avatarImg);
    show(els.avatarFallback);
    return;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data?.publicUrl;

  if (!url) {
    hide(els.avatarImg);
    show(els.avatarFallback);
    return;
  }

  if (els.avatarImg) {
    els.avatarImg.src = url + `?t=${Date.now()}`; // bust cache
    els.avatarImg.onload = () => {
      show(els.avatarImg);
      hide(els.avatarFallback);
    };
    els.avatarImg.onerror = () => {
      hide(els.avatarImg);
      show(els.avatarFallback);
    };
  }
}

/* -------------------- tabs -------------------- */
function bindTabs(type) {
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  const panes = {
    about: $("tab_about"),
    posts: $("tab_posts"),
    documents: $("tab_documents"),
    experience: $("tab_experience"),
    sea: $("tab_sea"),
  };

  // show/hide correct tabs
  const docBtn = $("tabDocumentsBtn");
  const expBtn = $("tabExperienceBtn");
  const seaBtn = $("tabSeaBtn");

  if (type === "seafarer") {
    docBtn && show(docBtn);
    seaBtn && show(seaBtn);
    expBtn && hide(expBtn);
  } else {
    docBtn && hide(docBtn);
    seaBtn && hide(seaBtn);
    expBtn && show(expBtn);
  }

  tabButtons.forEach((b) => {
    b.addEventListener("click", () => {
      tabButtons.forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      const key = b.getAttribute("data-tab");
      Object.values(panes).forEach(p => p && hide(p));
      if (key && panes[key]) show(panes[key]);
    });
  });

  // default show About
  tabButtons.forEach(x => x.classList.remove("active"));
  const first = tabButtons.find(b => b.getAttribute("data-tab") === "about") || tabButtons[0];
  first?.classList.add("active");
  Object.values(panes).forEach(p => p && hide(p));
  show(panes.about);
}

/* -------------------- load profile -------------------- */
async function loadMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  currentUser = u?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
    alert("Profile load failed: " + (error.message || "Unknown error"));
    return;
  }

  currentProfile = data;
  renderProfile(data);
}

/* -------------------- render profile -------------------- */
function renderProfile(p) {
  const tLabel = normalizeTypeLabel(p?.account_type);
  const tKey = typeKey(p?.account_type);

  const name = p?.full_name || "Profile";
  setText("profileName", name);
  setText("typeBadge", tLabel);

  setText("fullName", name);
  setText("email", p?.email || currentUser?.email || "");
  setText("nationality", p?.nationality || "—");
  setText("miniNationality", p?.nationality || "—");
  setText("bio", p?.bio || "—");

  // title label + value
  let titleLabel = "Title";
  let titleValue = "—";

  if (tKey === "seafarer") {
    titleLabel = "Ship role";
    titleValue = p?.rank || "—";
  } else if (tKey === "company") {
    titleLabel = "Company type";
    titleValue = p?.role || p?.company_name || "—";
  } else {
    titleLabel = "Professional role";
    titleValue = p?.role || p?.company_name || "—";
  }

  setText("titleLabel", titleLabel);
  setText("miniTitleLabel", titleLabel);
  setText("titleValue", titleValue);
  setText("miniTitle", titleValue);

  // headings
  if (els.aboutTitle) {
    els.aboutTitle.textContent =
      tKey === "company" ? "Company profile" :
      tKey === "professional" ? "Professional profile" :
      "Seafarer profile";
  }

  // tabs
  bindTabs(tKey);

  // avatar
  renderAvatar(p);

  // about edit buttons (basic toggle only; deeper dropdown fix is Step 2)
  bindAboutEdit(tKey);
}

/* -------------------- about edit (basic, safe) -------------------- */
function bindAboutEdit(tKey) {
  if (!els.editAboutBtn || !els.saveAboutBtn) return;

  let editing = false;

  const setEditing = (on) => {
    editing = on;

    if (on) {
      hide(els.editAboutBtn);
      show(els.saveAboutBtn);

      // editable fields: fullName + bio
      if (els.fullName) els.fullName.setAttribute("contenteditable", "true");
      if (els.bio) els.bio.setAttribute("contenteditable", "true");

      // show seafarer rank dropdown area only while editing (Step 2 will improve placement)
      if (tKey === "seafarer" && els.rankEditWrap) show(els.rankEditWrap);
    } else {
      show(els.editAboutBtn);
      hide(els.saveAboutBtn);

      if (els.fullName) els.fullName.removeAttribute("contenteditable");
      if (els.bio) els.bio.removeAttribute("contenteditable");

      if (els.rankEditWrap) hide(els.rankEditWrap);
    }
  };

  els.editAboutBtn.onclick = () => setEditing(true);

  els.saveAboutBtn.onclick = async () => {
    try {
      const newName = (els.fullName?.textContent || "").trim();
      const newBio = (els.bio?.textContent || "").trim();

      const payload = {
        full_name: newName,
        bio: newBio,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", currentUser.id);

      if (error) throw error;

      currentProfile = { ...(currentProfile || {}), ...payload };
      renderProfile(currentProfile);
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert("Save failed: " + (e.message || "Unknown error"));
    }
  };

  setEditing(false);
}

/* -------------------- init -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMyProfile();

  // avatar button = menu (B)
  els.avatarBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openAvatarMenu();
  });

  // file input -> crop
  els.avatarFile?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingBlob = null;
    openCropWithFile(file);
    // allow picking same file again
    e.target.value = "";
  });
});
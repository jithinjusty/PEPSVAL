import { supabase, getCurrentUser, sendNotification } from "/js/supabase.js";

/* =========================================================
   PEPSVAL FEED — FINAL BUG-FIX BUILD
   - Robust avatar everywhere
   - Avatar menu: settings + logout
   - Posts: create (media upload), delete
   - Likes + comments: instant update (no reload)
   - Comment likes + delete: safe (won’t crash if table/policy missing)
   - Clear on-screen errors when Supabase blocks (RLS/policy)
========================================================= */

const MEDIA_BUCKET = "post_media";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const elStatus = $("feedStatus");
const elList = $("feedList");

const elPostText = $("postText");
const elPostBtn = $("postBtn");
const elFileBtn = $("fileBtn");
const elFile = $("postFile");
const elFileInfo = $("fileInfo");
const elFileName = $("fileName");
const elClearFile = $("clearFile");

const elProgressWrap = $("progressWrap");
const elProgressFill = $("progressFill");
const elProgressPct = $("progressPct");
const elProgressLabel = $("progressLabel");

// Avatar/menu
const elMeAvatarBtn = $("meAvatarBtn");
const elMeMenu = $("meMenu");
const elMenuProfile = $("menuProfile");
const elMenuSettings = $("menuSettings");
const elMenuLogout = $("menuLogout");
const elMeAvatarImg = elMeAvatarBtn ? elMeAvatarBtn.querySelector("img.avatar") : null;

/* ---------- State ---------- */
let me = null;
let selectedFile = null;

/* ---------- UI helpers ---------- */
function setStatus(msg = "") { if (elStatus) elStatus.textContent = msg; }
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function toast(msg) {
  const t = $("toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(8px)";
  }, 2600);
}
function showProgress(on, label = "", pct = 0) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = on ? "block" : "none";
  if (!on) return;
  if (elProgressLabel) elProgressLabel.textContent = label;
  if (elProgressFill) elProgressFill.style.width = `${pct}%`;
  if (elProgressPct) elProgressPct.textContent = `${pct}%`;
}
function safeDate(v) {
  if (!v) return "";
  try { return new Date(v).toLocaleString(); } catch { return ""; }
}

/* ---------- Error surfacing (so you SEE what's failing) ---------- */
function showDbError(prefix, err) {
  const msg = err?.message || String(err || "Unknown error");
  console.error(prefix, err);
  setStatus(`❌ ${prefix}: ${msg}`);
  toast(`${prefix}: ${msg}`);
}

/* ---------- Auth ---------- */
async function requireLogin() {
  me = await getCurrentUser();
  if (!me) {
    toast("Not logged in — redirecting");
    window.location.href = "/auth/login.html";
    return false;
  }
  return true;
}

/* ---------- Avatar menu ---------- */
function setMenuOpen(open) {
  if (!elMeMenu) return;
  elMeMenu.style.display = open ? "block" : "none";
}
function isMenuOpen() {
  return !!elMeMenu && elMeMenu.style.display === "block";
}
function bindAvatarMenu() {
  // Sidebar Logout (Always bind if present)
  const logoutFn = async () => {
    try {
      setMenuOpen(false);
      setStatus("Logging out…");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/auth/login.html";
    } catch (err) {
      showDbError("Logout failed", err);
      setStatus("");
    }
  };

  document.getElementById("sidebarLogout")?.addEventListener("click", logoutFn);

  // Avatar Menu (Only bind if elements exist)
  if (!elMeAvatarBtn || !elMeMenu) return;

  elMeAvatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(!isMenuOpen());
  });

  document.addEventListener("click", (e) => {
    if (!isMenuOpen()) return;
    const inside = elMeMenu.contains(e.target) || elMeAvatarBtn.contains(e.target);
    if (!inside) setMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  elMenuProfile?.addEventListener("click", () => {
    setMenuOpen(false);
    window.location.href = "/profile/home.html";
  });

  elMenuSettings?.addEventListener("click", () => {
    setMenuOpen(false);
    window.location.href = "/dashboard/settings.html";
  });

  elMenuLogout?.addEventListener("click", logoutFn);
}

/* ---------- Avatar load (top-right) ---------- */
async function loadMyAvatar() {
  if (!me?.id) return;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", me.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      me.profile = data;
      if (elMeAvatarImg) {
        if (data.avatar_url) elMeAvatarImg.src = data.avatar_url;
        elMeAvatarImg.alt = data.full_name || "Me";
      }
    }
  } catch (e) {
    console.warn("Top avatar failed:", e?.message || e);
  }
}

/* ---------- Composer ---------- */
/* ---------- Image Editor State ---------- */
let editorState = {
  originalImage: null, // HTMLImageElement
  canvas: null,
  ctx: null,
  history: [], // Stack of states
  historyIndex: -1,

  // Current State
  filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 },
  crop: { x: 0, y: 0, w: 0, h: 0 }, // Relative to original image
  drawings: [], // Array of strokes { color, size, points: [{x,y},...] }
  texts: [], // Array of { text, x, y, color, size }

  // UI State
  activeTab: 'filters',
  drawColor: '#000000',
  drawSize: 5,
  isDrawing: false,
  drawMode: 'brush', // 'brush', 'erase'

  // Helpers
  scale: 1, // Canvas display scale
};

// Undo/Redo Management
function pushHistory() {
  const state = {
    filters: { ...editorState.filters },
    crop: { ...editorState.crop },
    drawings: JSON.parse(JSON.stringify(editorState.drawings)),
    texts: JSON.parse(JSON.stringify(editorState.texts))
  };

  // Remove future history if we pushed new state
  if (editorState.historyIndex < editorState.history.length - 1) {
    editorState.history = editorState.history.slice(0, editorState.historyIndex + 1);
  }

  editorState.history.push(state);
  editorState.historyIndex = editorState.history.length - 1;
  updateUndoRedoUI();
}

function undo() {
  if (editorState.historyIndex > 0) {
    editorState.historyIndex--;
    restoreState(editorState.history[editorState.historyIndex]);
    renderEditor();
    updateUndoRedoUI();
  }
}

function redo() {
  if (editorState.historyIndex < editorState.history.length - 1) {
    editorState.historyIndex++;
    restoreState(editorState.history[editorState.historyIndex]);
    renderEditor();
    updateUndoRedoUI();
  }
}

function restoreState(state) {
  editorState.filters = { ...state.filters };
  editorState.crop = { ...state.crop };
  editorState.drawings = JSON.parse(JSON.stringify(state.drawings));
  editorState.texts = JSON.parse(JSON.stringify(state.texts));

  // Update UI controls to match state
  updateFilterUI();
}

function updateUndoRedoUI() {
  const undoBtn = $("btnUndo");
  const redoBtn = $("btnRedo");
  if (undoBtn) undoBtn.disabled = editorState.historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = editorState.historyIndex >= editorState.history.length - 1;

  if (undoBtn) undoBtn.style.opacity = undoBtn.disabled ? 0.3 : 1;
  if (redoBtn) redoBtn.style.opacity = redoBtn.disabled ? 0.3 : 1;
}

function updateFilterUI() {
  $("rng-brightness").value = editorState.filters.brightness;
  $("val-brightness").textContent = editorState.filters.brightness + "%";

  $("rng-contrast").value = editorState.filters.contrast;
  $("val-contrast").textContent = editorState.filters.contrast + "%";

  $("rng-saturate").value = editorState.filters.saturate;
  $("val-saturate").textContent = editorState.filters.saturate + "%";

  $("rng-blur").value = editorState.filters.blur;
  $("val-blur").textContent = editorState.filters.blur + "px";

  // Reset active buttons
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  // (Simple logic: if custom values, maybe no preset is active, handling presets later)
}

/* ---------- Editor Logic ---------- */
function initEditor(file) {
  editorState.canvas = $("editCanvas");
  editorState.ctx = editorState.canvas.getContext("2d");

  const img = new Image();
  img.onload = () => {
    editorState.originalImage = img;
    // Reset State
    editorState.filters = { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 };
    editorState.crop = { x: 0, y: 0, w: img.width, h: img.height };
    editorState.drawings = [];
    editorState.texts = [];
    editorState.history = [];
    editorState.historyIndex = -1;

    pushHistory(); // Initial state

    // Switch to first tab
    switchTab('filters');

    // Show Modal
    const modal = $("editorModal");
    if (modal) modal.style.display = "flex";

    renderEditor();
  };
  img.src = URL.createObjectURL(file);
}

function renderEditor() {
  if (!editorState.originalImage || !editorState.ctx) return;

  const ctx = editorState.ctx;
  const img = editorState.originalImage;
  const crop = editorState.crop;

  // 1. Setup Canvas Size (rendering crop window)
  // Limit max size for performance
  const MAX_W = 1200;
  let dispW = crop.w;
  let dispH = crop.h;
  if (dispW > MAX_W) {
    const r = MAX_W / dispW;
    dispW = MAX_W;
    dispH = dispH * r;
  }

  editorState.canvas.width = dispW;
  editorState.canvas.height = dispH;
  editorState.scale = dispW / crop.w;

  // 2. Clear
  ctx.clearRect(0, 0, dispW, dispH);

  // 3. Apply Filters contextually
  const f = editorState.filters;
  let filterString = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) sepia(${f.sepia}%) grayscale(${f.grayscale}%) invert(${f.invert}%)`;

  // Manual color matrix simulation for warm/cool/vintage (simplified via overlay or CSS filters)
  // For standard canvas, CSS filters string is best.
  // Warm: sepia + saturate
  // Cool: hue-rotate
  if (f.warm > 0) filterString += ` sepia(${f.warm * 0.3}%) saturate(${100 + f.warm}%)`;
  if (f.cool > 0) filterString += ` hue-rotate(-${f.cool * 0.5}deg) saturate(${100 - f.cool * 0.2}%)`;
  if (f.vintage > 0) filterString += ` sepia(${f.vintage * 0.5}%) contrast(${100 + f.vintage * 0.2}%)`;

  ctx.filter = filterString;

  // 4. Draw Base Image (Cropped)
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, dispW, dispH);

  ctx.filter = "none"; // Reset filter for drawings/text

  // 5. Draw Strokes
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  editorState.drawings.forEach(stroke => {
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * editorState.scale;
    if (stroke.isErase) {
      ctx.globalCompositeOperation = "destination-out"; // Erase
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    // Coords are stored relative to Key Image Size (0..1) or Original Config ?
    // Let's store coords relative to CROP rect for simplicity or Original Image?
    // Storing relative to Original Image is robust against recrop, but complex.
    // Storing relative to Current View (0..1) is easiest.
    // Let's assume stroke points are normalized (0..1) of the crop window at time of drawing.

    if (stroke.points.length > 0) {
      // De-normalize
      ctx.moveTo(stroke.points[0].x * dispW, stroke.points[0].y * dispH);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * dispW, stroke.points[i].y * dispH);
      }
    }
    ctx.stroke();
  });

  ctx.globalCompositeOperation = "source-over";

  // 6. Draw Text
  editorState.texts.forEach(txt => {
    ctx.fillStyle = txt.color;
    ctx.font = `bold ${30 * editorState.scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt.text, txt.x * dispW, txt.y * dispH);
  });
}

function handleDrawing(e) {
  if (editorState.activeTab !== 'draw') return;
  const rect = editorState.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  if (e.type === 'mousedown') {
    editorState.isDrawing = true;
    editorState.currentStroke = {
      color: editorState.drawColor,
      size: editorState.drawSize,
      isErase: editorState.drawMode === 'erase',
      points: [{ x, y }]
    };
    editorState.drawings.push(editorState.currentStroke);
    renderEditor();
  } else if (e.type === 'mousemove' && editorState.isDrawing) {
    editorState.currentStroke.points.push({ x, y });
    renderEditor();
  } else if (e.type === 'mouseup' || e.type === 'mouseleave') {
    if (editorState.isDrawing) {
      editorState.isDrawing = false;
      pushHistory();
    }
  }
}

function applyPresetFilter(name) {
  // Reset base
  const reset = { brightness: 100, contrast: 100, saturate: 100, blur: 0, sepia: 0, grayscale: 0, invert: 0, warm: 0, cool: 0, vintage: 0 };

  if (name === 'grayscale') reset.grayscale = 100;
  if (name === 'sepia') reset.sepia = 100;
  if (name === 'invert') reset.invert = 100;
  if (name === 'warm') reset.warm = 50;
  if (name === 'cool') reset.cool = 50;
  if (name === 'vintage') reset.vintage = 60;

  editorState.filters = reset;
  renderEditor();
  updateFilterUI();

  // Highlight UI
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.filter-btn[data-filter="${name}"]`)?.classList.add("active");
  pushHistory();
}

function applyCrop(ratio) {
  const img = editorState.originalImage;
  if (!img) return;

  if (ratio === 'reset' || ratio === 'free') {
    editorState.crop = { x: 0, y: 0, w: img.width, h: img.height };
  } else {
    // Calculate centered box
    const [rw, rh] = ratio.split(':').map(Number);
    const imgRatio = img.width / img.height;
    const targetRatio = rw / rh;

    let cropW, cropH;

    if (imgRatio > targetRatio) {
      // Image is wider than target -> Height fits, trim width
      cropH = img.height;
      cropW = cropH * targetRatio;
    } else {
      // Image is taller -> Width fits, trim height
      cropW = img.width;
      cropH = cropW / targetRatio;
    }

    const cx = (img.width - cropW) / 2;
    const cy = (img.height - cropH) / 2;

    editorState.crop = { x: cx, y: cy, w: cropW, h: cropH };
  }

  renderEditor();
  pushHistory();
}

function addText() {
  const input = $("text-input");
  const txt = input.value.trim();
  if (!txt) return;

  editorState.texts.push({
    text: txt,
    x: 0.5, // Center
    y: 0.5,
    color: $("text-color").value || "#ffffff"
  });

  input.value = "";
  renderEditor();
  pushHistory();
}

function switchTab(tabId) {
  editorState.activeTab = tabId;
  document.querySelectorAll(".editor-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".editor-panel").forEach(p => p.classList.toggle("active", p.id === `panel-${tabId}`));
}

/* ---------- Binders ---------- */
function bindEditorEvents() {
  const modal = $("editorModal");
  if (!modal) return;

  // Global listeners
  $("closeEditorInv")?.addEventListener("click", () => { modal.style.display = "none"; setFileUI(null); elFile.value = ""; });
  $("cancelEdit")?.addEventListener("click", () => { modal.style.display = "none"; setFileUI(null); elFile.value = ""; });

  $("saveEdit")?.addEventListener("click", () => {
    if (!editorState.canvas) return;
    editorState.canvas.toBlob((blob) => {
      const editedFile = new File([blob], "edited_" + (editorState.originalImage?.name || "image.jpg"), { type: "image/jpeg" });
      setFileUI(editedFile);
      modal.style.display = "none";
      toast("Image Saved!");
    }, "image/jpeg", 0.95);
  });

  // Undo/Redo
  $("btnUndo")?.addEventListener("click", undo);
  $("btnRedo")?.addEventListener("click", redo);

  // Tabs
  document.querySelectorAll(".editor-tab").forEach(b => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });

  // Filters
  document.querySelectorAll(".filter-btn").forEach(b => {
    b.addEventListener("click", () => applyPresetFilter(b.dataset.filter));
  });

  // Adjust Sliders
  const bindSlider = (id, key, suffix = "%") => {
    $(id)?.addEventListener("input", (e) => {
      editorState.filters[key] = Number(e.target.value);
      $(`val-${key}`).textContent = e.target.value + suffix;
      renderEditor();
    });
    $(id)?.addEventListener("change", () => pushHistory()); // Save history on release
  };
  bindSlider("rng-brightness", "brightness");
  bindSlider("rng-contrast", "contrast");
  bindSlider("rng-saturate", "saturate");
  bindSlider("rng-blur", "blur", "px");

  // Crop Buttons
  document.querySelectorAll("[data-crop]").forEach(b => {
    b.addEventListener("click", () => applyCrop(b.dataset.crop));
  });

  // Draw Tools
  const canvas = $("editCanvas");
  canvas?.addEventListener("mousedown", handleDrawing);
  canvas?.addEventListener("mousemove", handleDrawing);
  canvas?.addEventListener("mouseup", handleDrawing);
  canvas?.addEventListener("mouseleave", handleDrawing);

  // Draw colors
  document.querySelectorAll(".color-dot").forEach(d => {
    d.addEventListener("click", () => {
      document.querySelectorAll(".color-dot").forEach(x => x.classList.remove("active"));
      d.classList.add("active");
      editorState.drawColor = d.dataset.color;
    });
  });

  $("rng-brush")?.addEventListener("input", (e) => {
    editorState.drawSize = Number(e.target.value);
    $("val-brush").textContent = e.target.value + "px";
  });

  $("btn-draw-mode")?.addEventListener("click", () => { editorState.drawMode = 'brush'; toast("Brush Mode"); });
  $("btn-erase-mode")?.addEventListener("click", () => { editorState.drawMode = 'erase'; toast("Eraser Mode"); });
  $("btn-clear-draw")?.addEventListener("click", () => {
    if (confirm("Clear all drawings?")) {
      editorState.drawings = [];
      renderEditor();
      pushHistory();
    }
  });

  // Text Tools
  $("btn-add-text")?.addEventListener("click", addText);
  $("btn-clear-text")?.addEventListener("click", () => {
    editorState.texts = [];
    renderEditor();
    pushHistory();
  });
}


function setFileUI(file) {
  selectedFile = file || null;

  if (!elFileInfo || !elFileName) return;
  if (!selectedFile) {
    elFileInfo.style.display = "none";
    elFileName.textContent = "";
    return;
  }
  elFileInfo.style.display = "flex";
  elFileName.textContent = selectedFile.name || "Attachment";
}

function openEditor(file) {
  if (!file || !file.type.startsWith("image/")) {
    setFileUI(file);
    return;
  }
  initEditor(file); // Use the new initEditor
}

function bindComposer() {
  elFileBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (f) openEditor(f);
  });

  elClearFile?.addEventListener("click", () => {
    if (elFile) elFile.value = "";
    setFileUI(null);
  });

  elPostBtn?.addEventListener("click", createPost);

  // init editor
  bindEditorEvents();
}

/* ---------- Media upload (Enhanced Progress) ---------- */
async function uploadMedia(file) {
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  showProgress(true, "Preparing…", 0);

  // Faux progress animation
  let pct = 0;
  const simulateInterval = setInterval(() => {
    pct += Math.random() * 10; // random increment
    if (pct > 90) pct = 90; // cap at 90 until real completion
    showProgress(true, "Uploading…", Math.round(pct));
  }, 200);

  try {
    const { error: upErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: false });

    if (upErr) throw upErr;

    // Success -> jump to 100
    clearInterval(simulateInterval);
    showProgress(true, "Finalizing…", 100);

    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl || null;

    setTimeout(() => showProgress(false), 800);
    return url;
  } catch (err) {
    clearInterval(simulateInterval);
    showProgress(false);
    throw err;
  }
}

/* ---------- Schema detection ---------- */
function detectPostKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (arr) => arr.find(k => keys.includes(k)) || null;
  return {
    idKey: pick(["id", "post_id"]),
    userKey: pick(["user_id", "author_id", "uid", "profile_id"]),
    contentKey: pick(["content", "body", "text", "caption", "post_text"]),
    mediaKey: pick(["media_url", "image_url", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"]),
  };
}
function getPostId(p, ks) { return (ks.idKey ? p[ks.idKey] : p.id) ?? null; }
function getPostUserId(p, ks) { return (ks.userKey ? p[ks.userKey] : (p.user_id || p.author_id)) ?? null; }
function getPostText(p, ks) { return (ks.contentKey ? p[ks.contentKey] : (p.content || p.body || "")) ?? ""; }
function getPostMedia(p, ks) { return (ks.mediaKey ? p[ks.mediaKey] : (p.media_url || null)) ?? null; }
function getPostCreated(p, ks) { return (ks.createdKey ? p[ks.createdKey] : (p.created_at || null)) ?? null; }

/* ---------- Data fetch ---------- */
async function fetchPosts() {
  let res = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  if (res.error) res = await supabase.from("posts").select("*").order("id", { ascending: false }).limit(50);
  if (res.error) throw res.error;
  return res.data || [];
}

async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

async function fetchProfilesMap(userIds) {
  if (!userIds.length) return new Map();

  let res = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, country")
    .in("id", userIds);

  if (res.error && /column .*country.* does not exist/i.test(res.error.message)) {
    res = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, rank")
      .in("id", userIds);
  }

  if (res.error) throw res.error;

  const map = new Map();
  (res.data || []).forEach(p => map.set(p.id, p));
  return map;
}

async function fetchLikes(postIds) {
  const counts = new Map();
  const mine = new Set();
  if (!postIds.length) return { counts, mine };

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) throw error;

  for (const l of (data || [])) {
    const pid = String(l.post_id);
    counts.set(pid, (counts.get(pid) || 0) + 1);
    if (l.user_id === me.id) mine.add(pid);
  }
  return { counts, mine };
}

async function fetchComments(postIds) {
  const counts = new Map();
  const byPost = new Map();
  if (!postIds.length) return { counts, byPost };

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, content, parent_id, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const c of (data || [])) {
    const pid = String(c.post_id);
    counts.set(pid, (counts.get(pid) || 0) + 1);
    const arr = byPost.get(pid) || [];
    arr.push(c);
    byPost.set(pid, arr);
  }
  return { counts, byPost };
}

/* comment_likes is optional; don’t crash if missing */
async function fetchCommentLikes(commentIds) {
  const counts = new Map();
  const mine = new Set();
  if (!commentIds.length) return { counts, mine, available: false };

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) {
    console.warn("comment_likes not available:", error.message);
    return { counts, mine, available: false };
  }

  for (const l of (data || [])) {
    const cid = String(l.comment_id);
    counts.set(cid, (counts.get(cid) || 0) + 1);
    if (l.user_id === me.id) mine.add(cid);
  }
  return { counts, mine, available: true };
}

/* ---------- Render helpers ---------- */
function renderMedia(url) {
  if (!url) return "";
  const u = String(url);
  if (u.match(/\.(mp4|mov|webm)(\?|$)/i)) {
    return `<div class="pv-media"><video class="pv-mediaEl" src="${esc(u)}" controls></video></div>`;
  }
  return `<div class="pv-media"><img class="pv-mediaEl" src="${esc(u)}" alt="media"></div>`;
}

function renderCommentRow(c, profMap, cLikeInfo) {
  const uid = c.user_id;
  const prof = uid ? (profMap.get(uid) || {}) : {};
  const name = prof.full_name || "Seafarer";
  const avatar = prof.avatar_url || "";
  const text = c.body || c.content || "";
  const mine = uid === me.id;

  const cid = String(c.id);
  const clCount = cLikeInfo.counts.get(cid) || 0;
  const clMine = cLikeInfo.mine.has(cid);
  const clAvail = cLikeInfo.available;

  const isReply = c.parent_id ? 'pv-commentReply' : '';
  return `
    <div class="pv-commentRow ${isReply}" data-comment-id="${esc(c.id)}" data-parent-id="${esc(c.parent_id || '')}">
      <a href="/profile/user.html?id=${esc(uid)}" class="pv-commentAvatar">
        ${avatar ? `<img src="${esc(avatar)}" alt="">` : `<div class="sAv"><span>${esc(name.slice(0, 1))}</span></div>`}
      </a>
      <div class="pv-commentBody">
        <div class="pv-commentTop">
          <a href="/profile/user.html?id=${esc(uid)}" class="pv-commentName">${esc(name)}</a>
          <div class="pv-commentMeta">${esc(safeDate(c.created_at))}</div>
        </div>
        <div class="pv-commentText">${esc(text)}</div>
        <div class="pv-commentActions">
          ${clAvail ? `<button class="pv-commentActionBtn ${clMine ? 'active' : ''}" data-action="likeComment" data-comment-id="${esc(c.id)}">
            ${clMine ? '❤️' : '🤍'} <span class="action-count">${clCount}</span>
          </button>` : ``}
          <button class="pv-commentActionBtn" data-action="replyComment" data-author-name="${esc(name)}" data-comment-id="${esc(c.id)}"><span>💬</span> Reply</button>
          ${mine ? `<button class="pv-commentActionBtn" data-action="deleteComment" data-comment-id="${esc(c.id)}" style="color:var(--danger)"><span>🗑️</span> Delete</button>` : ``}
        </div>
      </div>
    </div>
  `;
}


/* ---------- Sort Helper ---------- */
function sortCommentsThreaded(infoByPost) {
  // Sort logic: Parents first (by date), then their children (by date) immediately after
  const sortedMap = new Map();

  for (const [pid, comments] of infoByPost.entries()) {
    const parents = comments.filter(c => !c.parent_id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const children = comments.filter(c => c.parent_id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const result = [];

    // Recursive header to flatten tree
    const addNode = (node) => {
      result.push(node);
      const kids = children.filter(c => c.parent_id === node.id);
      kids.forEach(k => addNode(k));
    };

    parents.forEach(p => addNode(p));

    // Orphans (shouldn't happen often, but safe to append)
    const processedIds = new Set(result.map(c => c.id));
    children.forEach(c => {
      if (!processedIds.has(c.id)) result.push(c);
    });

    sortedMap.set(pid, result);
  }

  infoByPost.clear();
  sortedMap.forEach((v, k) => infoByPost.set(k, v));
}

function renderFeed(posts, ks, profMap, likeInfo, commentInfo, cLikeInfo) {
  if (!elList) return;

  if (!posts.length) {
    elList.innerHTML = `<div style="opacity:.7;padding:14px;">No posts yet</div>`;
    return;
  }

  // Pre-sort comments threaded
  sortCommentsThreaded(commentInfo.byPost);

  elList.innerHTML = posts.map(p => {
    const pid = getPostId(p, ks);
    const uid = getPostUserId(p, ks);

    const prof = uid ? (profMap.get(uid) || {}) : {};
    const name = prof.full_name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${esc(prof.rank)}` : "";
    const country = prof.country ? ` • ${esc(prof.country)}` : "";

    const text = getPostText(p, ks);
    const media = getPostMedia(p, ks);
    const created = getPostCreated(p, ks);

    const likes = likeInfo.counts.get(String(pid)) || 0;
    const iLiked = likeInfo.mine.has(String(pid));

    const commCount = commentInfo.counts.get(String(pid)) || 0;
    const comments = commentInfo.byPost.get(String(pid)) || [];

    const isMine = (uid === me.id);

    return `
      <article class="pv-post" data-post-id="${esc(pid)}" data-user-id="${esc(uid)}">
        <header class="pv-postHead">
          <div class="pv-user">
            <a href="/profile/user.html?id=${esc(uid)}" class="pv-userAvatar">
              ${avatar ? `<img src="${esc(avatar)}" alt="${esc(name)}">` : `<span>${esc(name.slice(0, 1))}</span>`}
            </a>
            <div class="pv-userMeta">
              <a href="/profile/user.html?id=${esc(uid)}" class="pv-userName">${esc(name)}</a>
              <div class="pv-userSub">${rank}${country}</div>
            </div>
          </div>
          <div class="pv-postRight">
            <div class="pv-time">${esc(safeDate(created))}</div>
            ${isMine ? `<button class="pv-linkBtn" data-action="deletePost">Delete</button>` : ``}
          </div>
        </header>

        <div class="pv-postText">${esc(text)}</div>
        ${renderMedia(media)}

        <div class="pv-actions">
          <button class="pv-actionBtn ${iLiked ? 'active' : ''}" data-action="toggleLike">
            <span class="action-icon">${iLiked ? '❤️' : '🤍'}</span>
            <span>Like</span>
            <span data-like-count>${likes}</span>
          </button>
          <button class="pv-actionBtn" data-action="toggleComments">
            <span class="action-icon">💬</span>
            <span>Comment</span>
            <span data-comment-count>${commCount}</span>
          </button>
          <button class="pv-actionBtn" data-action="sharePost">
            <span class="action-icon">🔗</span>
            <span>Share</span>
          </button>
        </div>

        <div class="pv-commentsWrap" data-comments style="display:none;">
          <div class="pv-commentsTitle">Comments</div>
          <div class="pv-commentsList">
            ${comments.length ? comments.map(c => renderCommentRow(c, profMap, cLikeInfo)).join("") : `<div style="opacity:.7;padding:8px 0;">No comments yet</div>`}
          </div>

          <div class="pv-commentComposer">
            <input data-comment-input placeholder="Write a comment…" />
            <button class="pv-btn" data-action="sendComment">Send</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- Mutations (instant UI) ---------- */
async function createPost() {
  const text = (elPostText?.value || "").trim();
  if (!text && !selectedFile) return toast("Write something or attach a file.");

  try {
    elPostBtn && (elPostBtn.disabled = true);
    setStatus("Posting…");

    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    let res = await supabase.from("posts").insert([{
      user_id: me.id,
      content: text,
      media_url: mediaUrl,
      created_at: new Date().toISOString()
    }]).select("*").maybeSingle();

    if (res.error) {
      // fallback schema
      res = await supabase.from("posts").insert([{
        user_id: me.id,
        body: text,
        media_url: mediaUrl
      }]).select("*").maybeSingle();
    }

    if (res.error) throw res.error;

    // reset composer
    if (elPostText) elPostText.value = "";
    if (elFile) elFile.value = "";
    setFileUI(null);

    toast("Posted");
    setStatus("");

    // Reload list (safe + consistent)
    await loadFeed();
  } catch (e) {
    showDbError("Post failed", e);
    setStatus("");
  } finally {
    elPostBtn && (elPostBtn.disabled = false);
  }
}

async function deletePost(postId) {
  if (!postId) return;
  if (!confirm("Delete this post?")) return;

  try {
    setStatus("Deleting…");
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", me.id);
    if (error) throw error;

    // instant DOM remove
    const el = elList.querySelector(`article[data-post-id="${CSS.escape(postId)}"]`);
    el?.remove();

    toast("Deleted");
    setStatus("");
  } catch (e) {
    showDbError("Delete post failed", e);
    setStatus("");
  }
}

async function toggleLike(postId, postEl) {
  const btn = postEl.querySelector('[data-action="toggleLike"]');
  const countEl = postEl.querySelector("[data-like-count]");
  if (!btn || !countEl) return;
  const ownerId = postEl.getAttribute("data-user-id");

  const currentlyLiked = btn.classList.contains("active");
  let count = Number(countEl.textContent || "0");

  // optimistic UI
  const iconEl = btn.querySelector(".action-icon");
  if (currentlyLiked) {
    count = Math.max(0, count - 1);
    btn.classList.remove("active");
    if (iconEl) iconEl.textContent = "🤍";
  }
  else {
    count = count + 1;
    btn.classList.add("active");
    if (iconEl) iconEl.textContent = "❤️";
  }
  countEl.textContent = String(count);

  try {
    if (currentlyLiked) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
      if (error) throw error;
    } else {
      // insert (if duplicate happens, policy/table should have unique; if not, this still works mostly)
      const { error } = await supabase.from("post_likes").insert([{ post_id: postId, user_id: me.id }]);
      if (error) throw error;
      if (ownerId && ownerId !== me.id) {
        await sendNotification(ownerId, "New Like", `${me.profile?.full_name || 'Someone'} liked your post.`, { postId });
      }
    }
  } catch (e) {
    // rollback UI
    if (currentlyLiked) {
      countEl.textContent = String(count + 1);
      btn.classList.add("active");
      if (iconEl) iconEl.textContent = "❤️";
    }
    else {
      countEl.textContent = String(Math.max(0, count - 1));
      btn.classList.remove("active");
      if (iconEl) iconEl.textContent = "🤍";
    }
    showDbError("Like failed", e);
  }
}

async function sendComment(postId, postEl) {
  const wrap = postEl.querySelector("[data-comments]");
  const input = wrap?.querySelector("[data-comment-input]");
  const list = wrap?.querySelector(".pv-commentsList");
  const countEl = postEl.querySelector("[data-comment-count]");
  const ownerId = postEl.getAttribute("data-user-id");

  const txt = (input?.value || "").trim();
  if (!txt) return;

  // optimistic UI append
  const pid = postId;
  const parentId = input.getAttribute("data-reply-to") || null;

  const mockComment = {
    id: "temp-" + Date.now(),
    user_id: me.id,
    body: txt,
    parent_id: parentId,
    created_at: new Date().toISOString()
  };

  const profMap = new Map();
  profMap.set(me.id, me.profile || { full_name: "Me", avatar_url: null });
  const cLikeInfo = { counts: new Map(), mine: new Set(), available: true };

  const rowHtml = renderCommentRow(mockComment, profMap, cLikeInfo);
  if (list) {
    // remove "No comments yet" if exists
    if (list.innerHTML.includes("No comments yet")) list.innerHTML = "";

    // Smart Insertion for optimistic UI:
    if (parentId) {
      const parentRow = list.querySelector(`[data-comment-id="${parentId}"]`);
      if (parentRow) {
        let insertAfterNode = parentRow;
        let nextNode = parentRow.nextElementSibling;
        while (nextNode && nextNode.getAttribute("data-parent-id") === parentId) {
          insertAfterNode = nextNode;
          nextNode = nextNode.nextElementSibling;
        }
        insertAfterNode.insertAdjacentHTML('afterend', rowHtml);
      } else {
        // Parent not found, append to end
        list.insertAdjacentHTML('beforeend', rowHtml);
      }
    } else {
      // Root comment, append to end
      list.insertAdjacentHTML('beforeend', rowHtml);
    }
  }

  if (countEl) countEl.textContent = String(Number(countEl.textContent || "0") + 1);
  if (input) {
    input.value = "";
    input.removeAttribute("data-reply-to");
    input.placeholder = "Write a comment…";
  }

  try {
    const { error } = await supabase.from("post_comments").insert([{
      post_id: pid,
      user_id: me.id,
      body: txt,
      parent_id: parentId,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      // fallback for older schema
      const { error: fallbackErr } = await supabase.from("post_comments").insert([{
        post_id: pid,
        user_id: me.id,
        content: txt
      }]);
      if (fallbackErr) throw fallbackErr;
    }

    // After successful DB insert, we don't need to do anything because the Realtime listener 
    // will pick it up or the optimistic UI is already there. 
    // Actually, to avoid duplicates (optimistic + realtime), we should handle that in the realtime listener.
    // For now, let's just toast and move on.

    if (ownerId && ownerId !== me.id) {
      const senderName = me.profile?.full_name || "Someone";
      await sendNotification(ownerId, "New Comment", `${senderName} commented on your post.`, { postId: pid });
    }

  } catch (e) {
    // rollback optimistic UI: find the temp row
    const tempRow = list?.querySelector(`[data-comment-id^="temp-"]`);
    tempRow?.remove();

    if (countEl) countEl.textContent = String(Math.max(0, Number(countEl.textContent || "1") - 1));
    showDbError("Comment failed", e);
  }
}

async function toggleCommentLike(commentId, btn) {
  const currentlyLiked = btn.classList.contains("active");
  const countEl = btn.querySelector(".action-count");
  let count = countEl ? Number(countEl.textContent) : 0;

  // optimistic UI
  if (currentlyLiked) {
    count = Math.max(0, count - 1);
    btn.classList.remove("active");
    btn.innerHTML = `🤍 <span class="action-count">${count}</span>`;
  } else {
    count++;
    btn.classList.add("active");
    btn.innerHTML = `❤️ <span class="action-count">${count}</span>`;
  }

  try {
    if (currentlyLiked) {
      const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", me.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("comment_likes").insert([{ comment_id: commentId, user_id: me.id }]);
      if (error) throw error;
    }
  } catch (e) {
    // rollback
    if (currentlyLiked) {
      count++;
      btn.classList.add("active");
      btn.innerHTML = `❤️ <span class="action-count">${count}</span>`;
    } else {
      count = Math.max(0, count - 1);
      btn.classList.remove("active");
      btn.innerHTML = `🤍 <span class="action-count">${count}</span>`;
    }
    showDbError("Comment like failed", e);
  }
}


async function deleteComment(commentId, rowEl) {
  if (!confirm("Delete this comment?")) return;
  try {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId).eq("user_id", me.id);
    if (error) throw error;

    // Remove the row
    rowEl.remove();

    // Also remove all replies to this comment from the DOM
    const list = rowEl.closest('.pv-commentsList');
    if (list) {
      const replies = list.querySelectorAll(`.pv-commentRow[data-parent-id="${commentId}"]`);
      replies.forEach(r => r.remove());
    }

    toast("Comment deleted");
  } catch (e) {
    showDbError("Delete comment failed", e);
  }
}

async function sharePost(postId, postEl) {
  const url = `${window.location.origin}/post.html?id=${postId}`;
  const title = "Check out this post on PEPSVAL";
  const text = postEl.querySelector(".pv-postText")?.textContent || "Interesting post!";

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: url
      });
      toast("Opened share menu");
    } catch (err) {
      // User cancelled or failed
      if (err.name !== 'AbortError') {
        console.warn('Share failed:', err);
        copyToClipboard(url);
      }
    }
  } else {
    // Fallback
    copyToClipboard(url);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast("Link copied to clipboard");
  }).catch(() => {
    prompt("Copy this link:", text);
  });
}

/* ---------- Events ---------- */
function bindFeedEvents() {
  if (!elList) return;

  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const postEl = e.target.closest("article[data-post-id]");
    const postId = postEl?.getAttribute("data-post-id");
    const action = btn.getAttribute("data-action");

    if (action === "toggleComments") {
      const wrap = postEl.querySelector("[data-comments]");
      if (!wrap) return;
      wrap.style.display = (wrap.style.display === "none" || !wrap.style.display) ? "block" : "none";
      return;
    }

    if (action === "toggleLike") return await toggleLike(postId, postEl);
    if (action === "sendComment") return await sendComment(postId, postEl);
    if (action === "deletePost") return await deletePost(postId);

    if (action === "sharePost") return await sharePost(postId, postEl);

    if (action === "replyComment") {
      const author = btn.getAttribute("data-author-name");
      const cid = btn.getAttribute("data-comment-id");
      const wrap = postEl.querySelector("[data-comments]");
      const input = wrap?.querySelector("[data-comment-input]");
      if (input) {
        wrap.style.display = "block";
        input.value = `@${author} `;
        input.setAttribute("data-reply-to", cid);
        input.placeholder = `Replying to ${author}…`;
        input.focus();
      }
      return;
    }

    if (action === "likeComment") {
      const cid = btn.getAttribute("data-comment-id");
      return await toggleCommentLike(cid, btn);
    }

    if (action === "deleteComment") {
      const cid = btn.getAttribute("data-comment-id");
      const row = btn.closest(".pv-commentRow");
      return await deleteComment(cid, row);
    }
  });

  // Enter key to submit comment
  elList.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    if (e.target.matches("[data-comment-input]")) {
      e.preventDefault(); // prevent new line
      const postEl = e.target.closest("article[data-post-id]");
      const postId = postEl?.getAttribute("data-post-id");
      await sendComment(postId, postEl);
    }
  });
}

/* ---------- Main load ---------- */
function showSkeleton() {
  if (!elList) return;
  elList.innerHTML = Array(3).fill(0).map(() => `
    <div class="pv-post animate-slide-up" style="padding:16px;">
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
        <div class="skeleton" style="width:44px; height:44px; border-radius:50%;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="width:120px; height:12px; margin-bottom:8px;"></div>
          <div class="skeleton" style="width:80px; height:10px;"></div>
        </div>
      </div>
      <div class="skeleton" style="width:100%; height:100px; border-radius:12px; margin-bottom:16px;"></div>
      <div style="display:flex; gap:16px;">
        <div class="skeleton" style="width:60px; height:20px; border-radius:10px;"></div>
        <div class="skeleton" style="width:60px; height:20px; border-radius:10px;"></div>
      </div>
    </div>
  `).join("");
}

async function loadFeed() {
  try {
    showSkeleton();
    setStatus("Loading feed…");

    const posts = await fetchPosts();
    const ks = detectPostKeys(posts[0] || {});

    const postIds = [];
    const userIds = [];

    for (const p of posts) {
      const pid = getPostId(p, ks);
      if (pid) postIds.push(pid);

      const uid = getPostUserId(p, ks);
      if (uid) userIds.push(uid);
    }

    const likesInfo = await fetchLikes(postIds);
    const commentsInfo = await fetchComments(postIds);

    // collect commenters for avatar
    const commentIds = [];
    for (const arr of commentsInfo.byPost.values()) {
      for (const c of arr) {
        if (c.id) commentIds.push(c.id);
        if (c.user_id) userIds.push(c.user_id);
      }
    }

    const profMap = await fetchProfilesMap([...new Set(userIds.filter(Boolean))]);
    const cLikeInfo = await fetchCommentLikes(commentIds);

    renderFeed(posts, ks, profMap, likesInfo, commentsInfo, cLikeInfo);

    // --- REAL-TIME UPDATES FOR COMMENTS ---
    supabase.channel('public:post_comments')
      .on('postgres_changes', { event: 'INSERT', table: 'post_comments' }, async (payload) => {
        const c = payload.new;

        const postEl = elList.querySelector(`article[data-post-id="${c.post_id}"]`);
        if (!postEl) return;

        // 1. Handle "own comment" optimistic update (replace temp row)
        if (c.user_id === me.id) {
          const list = postEl.querySelector(".pv-commentsList");
          const tempRow = list?.querySelector(`[data-comment-id^="temp-"]`);
          if (tempRow) {
            tempRow.setAttribute("data-comment-id", c.id);
            tempRow.querySelectorAll("[data-comment-id]").forEach(el => el.setAttribute("data-comment-id", c.id));
            return;
          }
        }

        // 2. Regular insertion (incoming comment/reply)
        const countEl = postEl.querySelector("[data-comment-count]");
        if (countEl) countEl.textContent = String(Number(countEl.textContent || "0") + 1);

        const list = postEl.querySelector(".pv-commentsList");
        if (list) {
          if (list.innerHTML.includes("No comments yet")) list.innerHTML = "";

          const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", c.user_id).single();
          const tempMap = new Map();
          if (prof) tempMap.set(c.user_id, prof);
          const mockCLikes = { counts: new Map(), mine: new Set(), available: true };
          const rowHtml = renderCommentRow(c, tempMap, mockCLikes);

          // Smart Insertion:
          // If it's a reply, try to find the parent or the last sibling reply to insert after.
          if (c.parent_id) {
            // Find parent row
            const parentRow = list.querySelector(`[data-comment-id="${c.parent_id}"]`);
            if (parentRow) {
              let insertAfterNode = parentRow;
              let nextNode = parentRow.nextElementSibling;
              while (nextNode && nextNode.getAttribute("data-parent-id") === c.parent_id) {
                insertAfterNode = nextNode;
                nextNode = nextNode.nextElementSibling;
              }

              insertAfterNode.insertAdjacentHTML('afterend', rowHtml);
              return;
            }
          }

          // Default: Append to end
          list.insertAdjacentHTML('beforeend', rowHtml);
        }
      })
      .on('postgres_changes', { event: 'DELETE', table: 'post_comments' }, (payload) => {
        const cid = payload.old.id;
        // Remove from DOM if exists
        const el = document.querySelector(`[data-comment-id="${cid}"]`);
        if (el) el.remove();

        // Also remove replies if any are currently visible
        const replies = document.querySelectorAll(`[data-parent-id="${cid}"]`);
        replies.forEach(r => r.remove());
      })
      .subscribe();

    setStatus("");
  } catch (e) {
    showDbError("Feed load failed", e);
  }
}


/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("error", (e) => showDbError("Script error", e?.error || e?.message));
  window.addEventListener("unhandledrejection", (e) => showDbError("Promise error", e?.reason));

  const ok = await requireLogin();
  if (!ok) return;

  bindAvatarMenu();
  await loadMyAvatar();

  bindComposer();
  bindFeedEvents();

  await loadFeed();

  // --- PROFILE SEARCH LOGIC ---
  const searchInput = $("searchInput");
  const searchDrop = $("searchDrop");

  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) {
        if (searchDrop) searchDrop.style.display = "none";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, rank")
        .ilike("full_name", `%${q}%`)
        .limit(10);

      if (error) {
        console.error("Profile search error:", error);
        return;
      }

      if (searchDrop) {
        if (!data || data.length === 0) {
          searchDrop.innerHTML = `<div style="padding:16px; font-size:14px; color:var(--text-muted); text-align:center;">No users found for "${esc(q)}"</div>`;
        } else {
          searchDrop.innerHTML = data.map(p => `
            <div class="searchItem" onclick="window.location.href='/profile/user.html?id=${p.id}'">
              <div class="pv-userAvatar" style="width:36px; height:36px;">
                ${p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : `<span style="font-weight:800; color:var(--brand);">${(p.full_name || "U").slice(0, 1)}</span>`}
              </div>
              <div class="sMeta">
                <div class="sName">${esc(p.full_name)}</div>
                <div class="sSub">${esc(p.rank || "Seafarer")}</div>
              </div>
            </div>
          `).join("");
        }
        searchDrop.style.display = "block";
      }
    });

    document.addEventListener("click", (e) => {
      if (searchDrop && !searchInput.contains(e.target) && !searchDrop.contains(e.target)) {
        searchDrop.style.display = "none";
      }
    });
  }
});

// /setup/profile-setup.js (FULL) — remembers dial code + saves avatar to Supabase Storage
import { supabase } from "/js/supabaseClient.js";
import { ROUTES } from "/js/config.js";

function $(id){ return document.getElementById(id); }

const form = $("setupForm");
const saveBtn = $("saveBtn");
const errorBox = $("errorBox");

const accountType = $("accountType");
const accountTypeOtherWrap = $("accountTypeOtherWrap");
const accountTypeOther = $("accountTypeOther");

const fullName = $("fullName");
const dobEl = $("dob");

const rankWrap = $("rankWrap");
const rankSearch = $("rankSearch");
const rankValue = $("rankValue");
const rankList = $("rankList");
const rankOtherWrap = $("rankOtherWrap");
const rankOther = $("rankOther");

const countrySearch = $("countrySearch");
const countryValue = $("countryValue");
const countryList = $("countryList");

const dialSearch = $("dialSearch");
const dialValue = $("dialValue");
const dialList = $("dialList");
const phoneInput = $("phoneInput");

// Photo
const photoInput = $("photoInput");
const avatarPreview = $("avatarPreview");
const removePhotoBtn = $("removePhotoBtn");
let selectedPhotoFile = null;
let existingAvatarUrl = null; // loaded from DB/local if present

function showError(msg){
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}
function clearError(){
  errorBox.style.display = "none";
  errorBox.textContent = "";
}
function busy(b){
  saveBtn.disabled = b;
  saveBtn.textContent = b ? "Saving..." : "Save & Continue";
}

// ---- ranks (same as before, you can add more later) ----
const RANKS = [
  "Master / Captain","Staff Captain","Chief Officer / C/O","Chief Mate",
  "Second Officer / 2/O","Second Mate","Third Officer / 3/O","Third Mate",
  "Safety Officer","Training Officer","Deck Cadet",
  "Bosun (Boatswain)","Able Seaman (AB)","Ordinary Seaman (OS)","Deck Fitter",

  "Chief Engineer / C/E","First Engineer","Second Engineer / 2/E","Third Engineer / 3/E",
  "Fourth Engineer / 4/E","Fifth Engineer","Junior Engineer / Trainee Engineer",
  "Engine Cadet","Motorman","Oiler","Wiper","Fitter","Welder","Pumpman (Tanker)","Reefer Engineer",

  "ETO (Electro-Technical Officer)","Electrician","Electronics Technician","IT Officer / IT Support","Radio Officer",

  "Chief Cook","Cook","Chief Steward","Steward","Messman","Cabin Steward",

  "Offshore Installation Manager (OIM)","Barge Master","Tow Master",
  "DPO (Dynamic Positioning Operator)","Senior DPO","Junior DPO / Trainee DPO",
  "DP Maintenance / DP Technician","Rigger","Crane Operator","Roustabout","Deck Foreman",
  "Fast Rescue Craft Coxswain","ROV Pilot Technician","ROV Supervisor","Subsea Engineer","Subsea Supervisor",
  "Diving Supervisor","Saturation Diver","Air Diver",

  "Toolpusher","Driller","Assistant Driller","Derrickman","Floorman","Roughneck",
  "Mud Engineer","Mud Logger","Wellsite Supervisor","Well Test Operator","BOP Technician",
  "Mechanical Technician (Rig)","Electrical Technician (Rig)","Instrument Technician (Rig)",

  "Hydrographic Surveyor","Survey Party Chief","Geophysicist","Marine Scientist","Research Technician","Party Chief (Survey)",

  "Harbour Master","Tug Master","Pilot (Marine)","Coxswain","Workboat Master",

  "Marine Superintendent","Technical Superintendent","Crewing / Manning Staff","HSEQ Officer","Trainer / Instructor",

  "Other"
];

let COUNTRIES = [];
async function loadCountries(){
  try{
    const res = await fetch("/countries.json?v=1", { cache:"no-store" });
    if(!res.ok) throw new Error("countries.json not found");
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error("countries.json invalid");
    COUNTRIES = data.map(c => ({
      name: (c.name||"").trim(),
      dial_code: (c.dial_code||"").toString().replace(/\s+/g,""),
      code: (c.code||"").trim()
    })).filter(x=>x.name);
  } catch(e){
    COUNTRIES = [
      { name:"India", dial_code:"+91", code:"IN" },
      { name:"Ireland", dial_code:"+353", code:"IE" },
      { name:"United Kingdom", dial_code:"+44", code:"GB" },
      { name:"Singapore", dial_code:"+65", code:"SG" }
    ];
  }
}

// Dropdown helpers
function closeList(listEl){ listEl.classList.remove("show"); }
function renderList(listEl, rows){
  listEl.innerHTML = "";
  if(!rows.length){
    const d=document.createElement("div");
    d.className="comboEmpty";
    d.textContent="No results";
    listEl.appendChild(d);
    listEl.classList.add("show");
    return;
  }
  rows.forEach(r => listEl.appendChild(r));
  listEl.classList.add("show");
}
function attachCombo(inputEl, listEl, getRows){
  const refresh=()=>renderList(listEl, getRows(inputEl.value));
  inputEl.addEventListener("focus", refresh);
  inputEl.addEventListener("input", refresh);

  document.addEventListener("click", (e)=>{
    if(listEl.contains(e.target) || inputEl.contains(e.target)) return;
    closeList(listEl);
  });
}

function initRankCombo(){
  attachCombo(rankSearch, rankList, (q)=>{
    const t=(q||"").toLowerCase().trim();
    const list = !t ? RANKS : RANKS.filter(r=>r.toLowerCase().includes(t));
    return list.slice(0,100).map(r=>{
      const row=document.createElement("div");
      row.className="comboItem";
      row.innerHTML = `<strong>${r}</strong>`;
      row.onclick=()=>{
        rankSearch.value=r;
        rankValue.value=r;
        closeList(rankList);

        if(r==="Other") rankOtherWrap.classList.remove("hidden");
        else { rankOtherWrap.classList.add("hidden"); rankOther.value=""; }
      };
      return row;
    });
  });
}

function initCountryCombos(){
  attachCombo(countrySearch, countryList, (q)=>{
    const t=(q||"").toLowerCase().trim();
    const list = !t ? COUNTRIES : COUNTRIES.filter(c=>c.name.toLowerCase().includes(t));
    return list.slice(0,100).map(c=>{
      const row=document.createElement("div");
      row.className="comboItem";
      row.innerHTML = `<strong>${c.name}</strong> <span style="color:#5d7a88;">(${c.code})</span>`;
      row.onclick=()=>{
        countrySearch.value=c.name;
        countryValue.value=c.code || c.name;
        closeList(countryList);

        // Always set dial code when a country is picked
        if(c.dial_code){
          dialSearch.value=c.dial_code;
          dialValue.value=c.dial_code;
        }
      };
      return row;
    });
  });

  attachCombo(dialSearch, dialList, (q)=>{
    const t=(q||"").toLowerCase().trim();
    const base = COUNTRIES.filter(c=>c.dial_code).map(c=>({name:c.name, dial_code:c.dial_code, code:c.code}));
    const list = !t ? base : base.filter(c=>c.dial_code.toLowerCase().includes(t) || c.name.toLowerCase().includes(t));
    return list.slice(0,100).map(c=>{
      const row=document.createElement("div");
      row.className="comboItem";
      row.innerHTML = `<strong>${c.dial_code}</strong> <span style="color:#5d7a88;">${c.name}</span>`;
      row.onclick=()=>{
        dialSearch.value=c.dial_code;
        dialValue.value=c.dial_code;
        closeList(dialList);

        // set country too (nice)
        if(c.code){
          countrySearch.value=c.name;
          countryValue.value=c.code;
        }
      };
      return row;
    });
  });
}

function updateAccountTypeUI(){
  const t = accountType.value;

  if(t==="other") accountTypeOtherWrap.classList.remove("hidden");
  else accountTypeOtherWrap.classList.add("hidden");

  if(t==="seafarer") rankWrap.classList.remove("hidden");
  else {
    rankWrap.classList.add("hidden");
    rankSearch.value=""; rankValue.value="";
    rankOtherWrap.classList.add("hidden"); rankOther.value="";
  }
}
accountType.addEventListener("change", updateAccountTypeUI);

// Avatar UI helper
function setAvatar(url){
  if(url){
    existingAvatarUrl = url;
    avatarPreview.innerHTML = `<img src="${url}" alt="Profile photo" />`;
  } else {
    existingAvatarUrl = null;
    avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
  }
}

// Photo preview (cannot persist file, only URL can persist)
photoInput.addEventListener("change", ()=>{
  const f = photoInput.files?.[0] || null;
  selectedPhotoFile = f;
  if(!f){
    if(existingAvatarUrl) setAvatar(existingAvatarUrl);
    else setAvatar(null);
    return;
  }
  const url = URL.createObjectURL(f);
  avatarPreview.innerHTML = `<img src="${url}" alt="Profile photo" />`;
});

removePhotoBtn.addEventListener("click", ()=>{
  selectedPhotoFile=null;
  photoInput.value="";
  setAvatar(null);
});

// Validation (DOB required; photo+phone optional)
function validate(){
  clearError();
  const t = accountType.value;
  if(!t) return {ok:false,msg:"Please select account type."};
  if(t==="other" && !accountTypeOther.value.trim()) return {ok:false,msg:"Please specify account type."};

  const dob = (dobEl.value || "").trim();
  if(!dob) return {ok:false,msg:"Please select date of birth."};

  if(!countrySearch.value.trim()) return {ok:false,msg:"Please select nationality."};

  if(t==="seafarer"){
    const r = (rankValue.value || rankSearch.value).trim();
    if(!r) return {ok:false,msg:"Please select your rank."};
    if(r==="Other" && !rankOther.value.trim()) return {ok:false,msg:"Please enter your rank (Other)."};
  }

  // phone optional
  const phone = phoneInput.value.trim();
  if(phone && !dialSearch.value.trim()) return {ok:false,msg:"Please select country code for mobile number."};

  return {ok:true};
}

async function ensureSession(){
  const { data:{ session } } = await supabase.auth.getSession();
  if(!session?.user){
    window.location.href = ROUTES.login;
    return null;
  }
  return session;
}

// Missing column auto-fix
function parseMissingColumn(msg){
  const m = /Could not find the '([^']+)' column/i.exec(msg || "");
  return m?.[1] || null;
}
async function upsertWithAutoColumnFix(payload){
  let p = { ...payload };
  for(let attempt=1; attempt<=8; attempt++){
    const { error } = await supabase.from("profiles").upsert(p, { onConflict:"id" });
    if(!error) return { ok:true, saved:p };

    const missing = parseMissingColumn(error.message);
    if(missing && Object.prototype.hasOwnProperty.call(p, missing)){
      delete p[missing];
      continue;
    }
    return { ok:false, error };
  }
  return { ok:false, error:{ message:"Schema mismatch. Please update profiles table." } };
}

// Local backup (so dial code and fields always restore)
const LS_KEY = "pepsval_profile_local_v3";
function saveLocalProfile(obj){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }catch(_){}
}
function loadLocalProfile(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }catch(_){ return null; }
}

function applyToUI(p){
  if(!p) return;

  if(p.account_type){
    const v = String(p.account_type).toLowerCase();
    if(["seafarer","employer","shore","other"].includes(v)){
      accountType.value = v;
    } else {
      accountType.value = "other";
      accountTypeOther.value = p.account_type;
    }
  }

  fullName.value = p.full_name || "";
  if(p.dob) dobEl.value = p.dob;

  if(p.nationality) countrySearch.value = p.nationality;

  // ✅ Always restore dial code & phone if we have it (DB or local)
  if(p.phone_dial){
    dialSearch.value = p.phone_dial;
    dialValue.value = p.phone_dial;
  }
  if(p.phone_number) phoneInput.value = p.phone_number;

  if(p.rank){
    rankSearch.value = p.rank;
    rankValue.value = p.rank;
    if(p.rank === "Other"){
      rankOtherWrap.classList.remove("hidden");
      rankOther.value = p.rank_other || "";
    }
  }

  // ✅ Restore avatar
  if(p.avatar_url){
    setAvatar(p.avatar_url);
  }

  updateAccountTypeUI();
}

async function prefillFromDBOrLocal(userId){
  // DB first
  try{
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if(!error && data){
      applyToUI(data);
      saveLocalProfile(data);
      return;
    }
  }catch(_){}

  // Local fallback
  const local = loadLocalProfile();
  if(local) applyToUI(local);
}

// -------- Avatar upload to Supabase Storage (bucket: avatars) --------
async function uploadAvatarIfNeeded(userId){
  if(!selectedPhotoFile) return existingAvatarUrl; // no new file chosen

  const file = selectedPhotoFile;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ext.replace(/[^a-z0-9]/g,"") || "jpg";
  const path = `${userId}/avatar_${Date.now()}.${safeExt}`;

  // Upload
  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if(upErr){
    // Don't block saving profile; just show warning
    showError("Photo upload failed (profile saved without photo): " + upErr.message);
    return existingAvatarUrl;
  }

  // Get public URL
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data?.publicUrl || null;

  if(publicUrl){
    existingAvatarUrl = publicUrl;
    setAvatar(publicUrl);
  }
  return publicUrl;
}

async function saveProfile(){
  const session = await ensureSession();
  if(!session) return;

  const userId = session.user.id;
  const t = accountType.value;

  // Upload avatar (optional)
  const avatarUrl = await uploadAvatarIfNeeded(userId);

  const payload = {
    id: userId,
    full_name: fullName.value.trim() || null,
    account_type: t==="other" ? (accountTypeOther.value.trim() || "other") : t,
    dob: (dobEl.value || "").trim(),
    nationality: countrySearch.value.trim() || null,

    // optional phone
    phone_dial: dialSearch.value.trim() || null,
    phone_number: phoneInput.value.trim() || null,

    // optional avatar url
    avatar_url: avatarUrl || null,

    // rank
    rank: null
  };

  if(t==="seafarer"){
    const r = (rankValue.value || rankSearch.value).trim();
    payload.rank = (r==="Other") ? (rankOther.value.trim() || "Other") : r;
  }

  const res = await upsertWithAutoColumnFix(payload);
  if(!res.ok){
    showError("Database error saving profile: " + (res.error?.message || "Unknown error"));
    // still store local backup so reopen works
    saveLocalProfile(payload);
    return;
  }

  // local backup (ensures dial code persists even if DB columns missing)
  saveLocalProfile(payload);

  window.location.href = ROUTES.dashboard;
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const v = validate();
  if(!v.ok) return showError(v.msg);

  busy(true);
  try{
    await saveProfile();
  } finally {
    busy(false);
  }
});

(async function boot(){
  await loadCountries();
  initRankCombo();
  initCountryCombos();
  updateAccountTypeUI();

  const session = await ensureSession();
  if(session?.user){
    await prefillFromDBOrLocal(session.user.id);
  }
})();
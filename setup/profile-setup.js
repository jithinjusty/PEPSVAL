// /setup/profile-setup.js (FULL) — with DOB (required)
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

// Photo (optional)
const photoInput = $("photoInput");
const avatarPreview = $("avatarPreview");
const removePhotoBtn = $("removePhotoBtn");
let selectedPhotoFile = null;

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

// ---- Expanded ranks ----
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
    return list.slice(0,90).map(r=>{
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
    return list.slice(0,90).map(c=>{
      const row=document.createElement("div");
      row.className="comboItem";
      row.innerHTML = `<strong>${c.name}</strong> <span style="color:#5d7a88;">(${c.code})</span>`;
      row.onclick=()=>{
        countrySearch.value=c.name;
        countryValue.value=c.code || c.name;
        closeList(countryList);

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
    return list.slice(0,90).map(c=>{
      const row=document.createElement("div");
      row.className="comboItem";
      row.innerHTML = `<strong>${c.dial_code}</strong> <span style="color:#5d7a88;">${c.name}</span>`;
      row.onclick=()=>{
        dialSearch.value=c.dial_code;
        dialValue.value=c.dial_code;
        closeList(dialList);

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

// Photo optional preview
photoInput.addEventListener("change", ()=>{
  const f = photoInput.files?.[0] || null;
  selectedPhotoFile = f;
  if(!f){
    avatarPreview.innerHTML=`<span class="avatarHint">Add photo</span>`;
    return;
  }
  const url = URL.createObjectURL(f);
  avatarPreview.innerHTML = `<img src="${url}" alt="Profile photo" />`;
});
removePhotoBtn.addEventListener("click", ()=>{
  selectedPhotoFile=null;
  photoInput.value="";
  avatarPreview.innerHTML=`<span class="avatarHint">Add photo</span>`;
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
  for(let attempt=1; attempt<=7; attempt++){
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

// Local backup (so user always sees what they saved)
const LS_KEY = "pepsval_profile_local_v2";
function saveLocalProfile(obj){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }catch(_){}
}
function loadLocalProfile(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }catch(_){ return null; }
}

// Prefill UI
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
  if(p.phone_dial){ dialSearch.value = p.phone_dial; dialValue.value = p.phone_dial; }
  if(p.phone_number) phoneInput.value = p.phone_number;

  if(p.rank){
    rankSearch.value = p.rank;
    rankValue.value = p.rank;
    if(p.rank === "Other"){
      rankOtherWrap.classList.remove("hidden");
      rankOther.value = p.rank_other || "";
    }
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

async function saveProfile(){
  const session = await ensureSession();
  if(!session) return;

  const t = accountType.value;

  const payload = {
    id: session.user.id,
    full_name: fullName.value.trim() || null,
    account_type: t==="other" ? (accountTypeOther.value.trim() || "other") : t,

    dob: (dobEl.value || "").trim(), // ✅ required

    nationality: countrySearch.value.trim() || null,

    // Optional (auto-removed if DB doesn't have them)
    phone_dial: dialSearch.value.trim() || null,
    phone_number: phoneInput.value.trim() || null,

    rank: null
  };

  if(t==="seafarer"){
    const r = (rankValue.value || rankSearch.value).trim();
    payload.rank = (r==="Other") ? (rankOther.value.trim() || "Other") : r;
  }

  // Photo upload intentionally not done yet to avoid breaking.
  // selectedPhotoFile will be used later.

  const res = await upsertWithAutoColumnFix(payload);
  if(!res.ok){
    showError("Database error saving profile: " + (res.error?.message || "Unknown error"));
    return;
  }

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
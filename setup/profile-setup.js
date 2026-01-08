// /setup/profile-setup.js (FULL) — stable + auto-removes unknown DB columns
// Fixes: "Could not find the '___' column of 'profiles' in the schema cache"
// Photo optional, phone optional, dropdowns work, redirects to /dashboard/

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

const RANKS = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Deck Cadet",
  "Chief Engineer / C/E",
  "Second Engineer / 2/E",
  "Third Engineer / 3/E",
  "Fourth Engineer / 4/E",
  "Engine Cadet",
  "Bosun",
  "AB (Able Seaman)",
  "OS (Ordinary Seaman)",
  "Motorman",
  "Oiler",
  "Fitter",
  "Cook",
  "Steward",
  "Electrician / ETO",
  "Pumpman",
  "Crane Operator",
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
function openList(listEl){ listEl.classList.add("show"); }
function closeList(listEl){ listEl.classList.remove("show"); }
function renderList(listEl, rows){
  listEl.innerHTML = "";
  if(!rows.length){
    const d=document.createElement("div");
    d.className="comboEmpty";
    d.textContent="No results";
    listEl.appendChild(d);
    openList(listEl);
    return;
  }
  rows.forEach(r => listEl.appendChild(r));
  openList(listEl);
}

function attachCombo(inputEl, listEl, getRows){
  function refresh(){ renderList(listEl, getRows(inputEl.value)); }
  inputEl.addEventListener("focus", refresh);
  inputEl.addEventListener("input", refresh);

  document.addEventListener("click", (e)=>{
    if(listEl.contains(e.target) || inputEl.contains(e.target)) return;
    closeList(listEl);
  });
}

// Rank combo
function initRankCombo(){
  attachCombo(rankSearch, rankList, (q)=>{
    const t=(q||"").toLowerCase().trim();
    const list = !t ? RANKS : RANKS.filter(r=>r.toLowerCase().includes(t));
    return list.slice(0,60).map(r=>{
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

// Country + Dial combos
function initCountryCombos(){
  attachCombo(countrySearch, countryList, (q)=>{
    const t=(q||"").toLowerCase().trim();
    const list = !t ? COUNTRIES : COUNTRIES.filter(c=>c.name.toLowerCase().includes(t));
    return list.slice(0,60).map(c=>{
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
    return list.slice(0,60).map(c=>{
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

// Account type logic
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

// Validation: photo + phone NOT mandatory
function validate(){
  clearError();
  const t = accountType.value;
  if(!t) return {ok:false,msg:"Please select account type."};
  if(t==="other" && !accountTypeOther.value.trim()) return {ok:false,msg:"Please specify account type."};
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

// ---- This is the key fix: remove missing columns automatically and retry ----
function parseMissingColumn(errorMessage){
  // Example: "Could not find the 'nationality_code' column of 'profiles' in the schema cache"
  const m = /Could not find the '([^']+)' column/i.exec(errorMessage || "");
  return m?.[1] || null;
}

async function upsertWithAutoColumnFix(payload){
  // Try up to 5 times removing unknown columns
  let p = { ...payload };

  for(let attempt=1; attempt<=5; attempt++){
    const { error } = await supabase.from("profiles").upsert(p, { onConflict:"id" });
    if(!error) return { ok:true };

    const missing = parseMissingColumn(error.message);
    if(missing && Object.prototype.hasOwnProperty.call(p, missing)){
      delete p[missing];
      continue;
    }

    // Not a missing-column error → stop
    return { ok:false, error };
  }

  return { ok:false, error: { message:"Too many schema mismatches. Please update profiles table." } };
}

async function saveProfile(){
  const session = await ensureSession();
  if(!session) return;

  const t = accountType.value;

  // Include extra fields if your DB has them; code will auto-remove if not.
  const payload = {
    id: session.user.id,
    full_name: fullName.value.trim() || null,
    account_type: t==="other" ? (accountTypeOther.value.trim() || "other") : t,

    // Nationality
    nationality: countrySearch.value.trim() || null,

    // OPTIONAL extra (if your DB supports it)
    nationality_code: countryValue.value.trim() || null,

    // Phone (optional)
    phone_dial: dialSearch.value.trim() || null,
    phone_number: phoneInput.value.trim() || null,

    // Rank
    rank: null,
  };

  if(t==="seafarer"){
    const r = (rankValue.value || rankSearch.value).trim();
    payload.rank = (r==="Other") ? (rankOther.value.trim() || "Other") : r;
  }

  // Photo upload: optional and not implemented yet (to avoid bugs)
  // selectedPhotoFile exists but we don't push to storage in this step.

  const result = await upsertWithAutoColumnFix(payload);
  if(!result.ok){
    showError("Database error saving profile: " + (result.error?.message || "Unknown error"));
    return;
  }

  // ✅ success
  window.location.href = ROUTES.dashboard; // /dashboard/
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
  await ensureSession();
})();
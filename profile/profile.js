import { supabase } from "/js/supabase.js";

const qs = (id) => document.getElementById(id);

/* ---------------- LOAD DROPDOWNS ---------------- */

async function loadCompanies() {
  const { data } = await supabase
    .from("companies")
    .select("name")
    .order("name");

  window.companyList = data || [];
}

const RANKS = [
  "Master","Chief Officer","Second Officer","Third Officer",
  "Chief Engineer","Second Engineer","Third Engineer",
  "Fourth Engineer","ETO","Bosun","AB","OS","Fitter",
  "Cook","Messman","Pumpman",
  "Offshore Installation Manager","Driller","Toolpusher",
  "ROV Pilot","DPO","Chief Mate","Barge Engineer"
];

const VESSEL_TYPES = [
  "Container","Bulk Carrier","Tanker","Chemical Tanker",
  "LNG","LPG","Car Carrier","Ro-Ro","General Cargo",
  "Offshore Supply","Platform Supply","Anchor Handler",
  "Drillship","FPSO","Research","Cruise","Yacht"
];

function attachCombo(inputId, list, hiddenId) {
  const input = qs(inputId);
  const box = qs(inputId.replace("Search","List"));
  const hidden = qs(hiddenId);

  input.addEventListener("input", () => {
    box.innerHTML = "";
    const q = input.value.toLowerCase();
    list.filter(v => v.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach(v => {
        const d = document.createElement("div");
        d.textContent = v;
        d.onclick = () => {
          input.value = v;
          hidden.value = v;
          box.innerHTML = "";
        };
        box.appendChild(d);
      });
  });
}

/* ---------------- SAVE SEA SERVICE ---------------- */

async function saveCompanyIfNew(name) {
  if (!name) return;
  await supabase.from("companies").insert({ name }).select().maybeSingle();
}

qs("seaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    vessel_name: qs("vesselName").value.trim(),
    imo_number: Number(qs("imoNumber").value),
    company_name: qs("seaCompany").value.trim(),
    rank: qs("seaRank").value.trim(),
    vessel_type: qs("vesselType").value.trim(),
    sign_on_date: qs("signOn").value,
    sign_off_date: qs("signOff").value || null
  };

  if (!payload.imo_number || !payload.sign_on_date) {
    alert("IMO number and Sign-on date are required");
    return;
  }

  await saveCompanyIfNew(payload.company_name);

  const { error } = await supabase.from("sea_service").insert(payload);

  if (error) {
    alert(error.message);
  } else {
    alert("Sea service added");
    qs("seaForm").reset();
    loadSeaService();
  }
});

/* ---------------- LOAD SEA SERVICE ---------------- */

async function loadSeaService() {
  const { data } = await supabase
    .from("sea_service")
    .select("*")
    .order("sign_on_date", { ascending:false });

  const box = qs("seaRows");
  box.innerHTML = "";

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div>${r.vessel_name}</div>
      <div>${r.vessel_type || "-"}</div>
      <div>${r.rank || "-"}</div>
      <div>${r.company_name || "-"}</div>
      <div>${r.sign_on_date} → ${r.sign_off_date || "Present"}</div>
      <div>Self-declared</div>
      <div></div>
    `;
    box.appendChild(div);
  });
}

/* ---------------- INIT ---------------- */

(async () => {
  await loadCompanies();

  attachCombo("seaRank", RANKS, "seaRank");
  attachCombo("vesselType", VESSEL_TYPES, "vesselType");
  attachCombo("seaCompany", window.companyList.map(c=>c.name), "seaCompany");

  loadSeaService();
})();
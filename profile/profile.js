import { supabase } from "/js/supabaseClient.js";

const tabsEl = document.getElementById("tabs");
const sections = document.querySelectorAll(".section");

let profile = null;

/* ------------------ INIT ------------------ */
init();

async function init(){
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  profile = data;
  renderHeader();
  renderTabs();
  renderSections();
}

/* ------------------ HEADER ------------------ */
function renderHeader(){
  document.getElementById("profileName").textContent = profile.full_name || "—";
  document.getElementById("profileSub").textContent = profile.account_type;
  document.getElementById("avatarImg").src =
    profile.avatar_url || "/assets/avatar.png";
}

/* ------------------ TABS ------------------ */
function renderTabs(){
  tabsEl.innerHTML = "";
  let tabs = [];

  if(profile.account_type === "seafarer")
    tabs = ["About","Documents","Sea Service","Posts"];

  if(profile.account_type === "company")
    tabs = ["About","Posts","Jobs"];

  if(profile.account_type === "professional")
    tabs = ["About","Posts","Experience"];

  tabs.forEach((t,i)=>{
    const el = document.createElement("div");
    el.className = "tab"+(i===0?" active":"");
    el.textContent = t;
    el.onclick = ()=>activateTab(t.toLowerCase().replace(" ",""));
    tabsEl.appendChild(el);
  });

  activateTab(tabs[0].toLowerCase().replace(" ",""));
}

function activateTab(id){
  sections.forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));

  document.getElementById(id).classList.add("active");
  [...tabsEl.children].find(t=>t.textContent.toLowerCase().replace(" ","")==id)
    .classList.add("active");
}

/* ------------------ SECTIONS ------------------ */
function renderSections(){
  renderAbout();
  renderDocuments();
  renderSeaService();
  renderPosts();
  renderJobs();
  renderExperience();
}

/* ------------------ ABOUT ------------------ */
function renderAbout(){
  const el = document.getElementById("about");
  el.innerHTML = `
    <label>Name</label><input value="${profile.full_name||""}">
    <label>DOB</label><input type="date" value="${profile.dob||""}">
    <label>Email</label><input value="${profile.email||""}">
    <label>Mobile</label><input value="${profile.mobile||""}">
    <label>About</label><textarea>${profile.bio||""}</textarea>
  `;
}

/* ------------------ DOCUMENTS ------------------ */
function renderDocuments(){
  if(profile.account_type!=="seafarer") return;
  document.getElementById("documents").innerHTML = `
    <table>
      <tr>
        <th>Issued By</th>
        <th>Issue</th>
        <th>Expiry</th>
        <th>Time Left</th>
      </tr>
    </table>
  `;
}

/* ------------------ SEA SERVICE ------------------ */
function renderSeaService(){
  if(profile.account_type!=="seafarer") return;
  document.getElementById("seaService").innerHTML = `
    <table>
      <tr>
        <th>Ship</th><th>IMO</th><th>Rank</th>
        <th>Sign On</th><th>Sign Off</th><th>Days</th>
      </tr>
    </table>
    <p><b>Total Sea Service:</b> auto-calculated</p>
  `;
}

/* ------------------ POSTS ------------------ */
function renderPosts(){
  document.getElementById("posts").innerHTML = `
    <p><b>Posts</b></p>
    <div id="postList">Posts load from feed</div>
  `;
}

/* ------------------ JOBS ------------------ */
function renderJobs(){
  if(profile.account_type!=="company") return;
  document.getElementById("jobs").innerHTML = `
    <h3>Jobs</h3>
    <button>Create Job</button>
  `;
}

/* ------------------ EXPERIENCE ------------------ */
function renderExperience(){
  if(profile.account_type!=="professional") return;
  document.getElementById("experience").innerHTML = `
    <h3>Experience</h3>
    <button>Add Experience</button>
  `;
}
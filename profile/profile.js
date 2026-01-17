import { supabase } from "/js/supabase.js";

/* ------------------ helpers ------------------ */
const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

const RANKS = [
  "Master / Captain","Chief Officer","Second Officer","Third Officer","Fourth Officer",
  "Deck Cadet","Bosun","AB / Able Seaman","OS / Ordinary Seaman",
  "Chief Engineer","Second Engineer","Third Engineer","Fourth Engineer",
  "Engine Cadet","Motorman","Oiler","Wiper","ETO","Electrician","Cook","Other"
];

/* ------------------ state ------------------ */
let currentUser = null;
let profile = null;

/* ------------------ avatar ------------------ */
function initials(name){
  if(!name) return "P";
  const p=name.trim().split(" ");
  return ((p[0]?.[0]||"")+(p[p.length-1]?.[0]||"")).toUpperCase();
}

function renderAvatar(){
  const img = $("avatarImg");
  const fb = $("avatarFallback");
  fb.textContent = initials(profile.full_name);

  if(!profile.avatar_url){
    hide(img); show(fb); return;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_url);
  img.src = data.publicUrl+"?t="+Date.now();
  img.onload=()=>{show(img);hide(fb)};
  img.onerror=()=>{hide(img);show(fb)};
}

async function saveAvatar(blob){
  const path = `${currentUser.id}/avatar.webp`;
  await supabase.storage.from("avatars")
    .upload(path, blob, { upsert:true, contentType:"image/webp" });

  await supabase.from("profiles")
    .update({ avatar_url:path })
    .eq("id", currentUser.id);

  profile.avatar_url = path;
  renderAvatar();
}

/* ------------------ crop modal ------------------ */
let cropBack, cropCanvas, ctx, imgObj;
let zoom=1.4, offX=0, offY=0;

function openCrop(file){
  if(!cropBack) initCrop();
  imgObj = new Image();
  imgObj.onload=()=>{ drawCrop(); cropBack.classList.add("show"); };
  imgObj.src = URL.createObjectURL(file);
}

function initCrop(){
  cropBack=document.createElement("div");
  cropBack.className="pvModalBack";
  cropBack.innerHTML=`
  <div class="pvModal">
    <div class="pvHead">
      <b>Adjust photo</b>
      <button id="closeCrop">✕</button>
    </div>
    <canvas id="cropCanvas" width="520" height="520"></canvas>
    <div class="pvControls">
      <label>Zoom <input id="zoom" type="range" min="1" max="3" step="0.01" value="1.4"></label>
      <button id="savePhoto">Save</button>
    </div>
  </div>`;
  document.body.appendChild(cropBack);

  cropCanvas=$("cropCanvas");
  ctx=cropCanvas.getContext("2d");

  $("closeCrop").onclick=()=>cropBack.classList.remove("show");
  $("zoom").oninput=e=>{zoom=e.target.value;drawCrop()};
  $("savePhoto").onclick=async()=>{
    const blob=await exportBlob();
    cropBack.classList.remove("show");
    saveAvatar(blob);
  };

  let dragging=false,lx,ly;
  cropCanvas.onpointerdown=e=>{dragging=true;lx=e.clientX;ly=e.clientY};
  cropCanvas.onpointermove=e=>{
    if(!dragging) return;
    offX+=e.clientX-lx; offY+=e.clientY-ly;
    lx=e.clientX; ly=e.clientY;
    drawCrop();
  };
  cropCanvas.onpointerup=()=>dragging=false;
}

function drawCrop(){
  if(!imgObj) return;
  ctx.clearRect(0,0,520,520);
  const w=imgObj.width*zoom;
  const h=imgObj.height*zoom;
  ctx.drawImage(imgObj,(520-w)/2+offX,(520-h)/2+offY,w,h);
}

async function exportBlob(){
  const out=document.createElement("canvas");
  out.width=720; out.height=720;
  const octx=out.getContext("2d");
  octx.drawImage(cropCanvas,0,0,720,720);
  return await new Promise(r=>out.toBlob(r,"image/webp",0.92));
}

/* ------------------ avatar menu ------------------ */
function avatarMenu(){
  const m=document.createElement("div");
  m.className="avatarMenu";
  m.innerHTML=`<button id="chg">Change photo</button>
               <button id="rem">Remove photo</button>`;
  document.body.appendChild(m);

  $("chg").onclick=()=>{$("avatarFile").click();m.remove()};
  $("rem").onclick=async()=>{
    await supabase.storage.from("avatars")
      .remove([`${currentUser.id}/avatar.webp`]);
    await supabase.from("profiles")
      .update({avatar_url:null}).eq("id",currentUser.id);
    profile.avatar_url=null;
    renderAvatar(); m.remove();
  };

  setTimeout(()=>document.addEventListener("click",()=>m.remove(),{once:true}),0);
}

/* ------------------ rank dropdown ------------------ */
function initRank(){
  const input=$("rankInput"), list=$("rankList");
  input.oninput=()=>{
    list.innerHTML="";
    RANKS.filter(r=>r.toLowerCase().includes(input.value.toLowerCase()))
      .forEach(r=>{
        const d=document.createElement("div");
        d.textContent=r;
        d.onclick=()=>{input.value=r;list.innerHTML=""};
        list.appendChild(d);
      });
  };
}

/* ------------------ tabs ------------------ */
document.querySelectorAll(".tab").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".tabPane").forEach(p=>hide(p));
    show($("tab_"+b.dataset.tab));
  };
});

/* ------------------ edit/save ------------------ */
$("editBtn").onclick=()=>{
  $("fullName").contentEditable="true";
  $("bio").contentEditable="true";
  show($("saveBtn"));
  hide($("editBtn"));
  if(profile.account_type==="seafarer") show($("rankField"));
};

$("saveBtn").onclick=async()=>{
  const payload={
    full_name:$("fullName").textContent.trim(),
    bio:$("bio").textContent.trim()
  };
  if(profile.account_type==="seafarer")
    payload.rank=$("rankInput").value.trim();

  await supabase.from("profiles")
    .update(payload).eq("id",currentUser.id);

  Object.assign(profile,payload);
  $("miniRole").textContent=profile.rank||profile.role||"—";
  hide($("saveBtn")); show($("editBtn"));
};

/* ------------------ load profile ------------------ */
async function load(){
  const { data } = await supabase.auth.getUser();
  currentUser=data.user;
  if(!currentUser){location="/auth/login.html";return;}

  const { data:p } = await supabase.from("profiles")
    .select("*").eq("id",currentUser.id).single();
  profile=p;

  $("profileName").textContent=p.full_name;
  $("email").textContent=p.email;
  $("fullName").textContent=p.full_name;
  $("bio").textContent=p.bio||"";
  $("nationality").textContent=p.nationality;
  $("miniNationality").textContent=p.nationality;

  $("typeBadge").textContent=p.account_type;
  $("miniRole").textContent=p.rank||p.role||"—";

  if(p.account_type==="seafarer"){
    show($("tabDocuments")); show($("tabSea"));
    hide($("tabExperience"));
    $("rankInput").value=p.rank||"";
    initRank();
  }else{
    hide($("tabDocuments")); hide($("tabSea"));
    show($("tabExperience"));
  }

  renderAvatar();
}

$("avatarBtn").onclick=avatarMenu;
$("avatarFile").onchange=e=>openCrop(e.target.files[0]);

load();
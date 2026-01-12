import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const userNameEl = document.getElementById("userName");
const userAvatarEl = document.getElementById("userAvatar");
const avatarBtn = document.getElementById("avatarBtn");
const avatarMenu = document.getElementById("avatarMenu");
const logoutBtn = document.getElementById("logoutBtn");

const postTextEl = document.getElementById("postText");
const postMediaEl = document.getElementById("postMedia");
const addMediaBtn = document.getElementById("addMedia");
const postBtn = document.getElementById("postBtn");
const mediaPreviewEl = document.getElementById("mediaPreview");
const feedListEl = document.getElementById("feedList");

let session = null;
let me = null;

const BUCKET = "post_media";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="100%" height="100%" rx="40" ry="40" fill="#e7f4f7"/>
    <circle cx="40" cy="32" r="14" fill="#1F6F86"/>
    <rect x="16" y="52" width="48" height="18" rx="9" fill="#1F6F86"/>
  </svg>`);

function escapeHtml(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmt(ts){ try{ return new Date(ts).toLocaleString(); }catch{return "";} }

function setTopBar(profile){
  userNameEl.textContent = profile?.full_name || profile?.username || "Member";
  userAvatarEl.src = profile?.avatar_url || DEFAULT_AVATAR;
  userAvatarEl.onerror = () => userAvatarEl.src = DEFAULT_AVATAR;
}

/* MENU */
avatarBtn.onclick = () => avatarMenu.hidden = !avatarMenu.hidden;
document.addEventListener("click", e=>{
  if(!avatarMenu.contains(e.target) && !avatarBtn.contains(e.target)){
    avatarMenu.hidden = true;
  }
});
logoutBtn.onclick = async ()=>{
  await supabase.auth.signOut();
  location.href="/auth/login.html";
};

/* Load posts */
async function loadPosts(){
  const {data,error} = await supabase
    .from("v_feed_posts")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){
    feedListEl.innerHTML=`<div class="errorBox">${error.message}</div>`;
    return;
  }

  feedListEl.innerHTML = data.map(p=>{
    const isMine = p.author_id === session.user.id;
    return `
      <div class="postCard">
        <div class="postHeader">
          <b>${escapeHtml(p.author_display_name)} ${isMine?"(you)":""}</b>
          <span class="postTime">${fmt(p.created_at)}</span>
        </div>

        <div class="postText">${escapeHtml(p.content||"")}</div>

        ${p.media_url ? 
          p.media_type.startsWith("image") 
            ? `<img src="${p.media_url}" class="postMediaImg">`
            : `<video src="${p.media_url}" class="postMediaVid" controls></video>`
          : ""}

        <div class="postFooter">
          <button>Like</button>
          <button>Comment</button>
          <button>Share</button>
          ${isMine ? `<button data-id="${p.id}" class="deleteBtn">Delete</button>`:""}
        </div>
      </div>
    `;
  }).join("");
}

/* Delete */
feedListEl.addEventListener("click", async e=>{
  if(e.target.classList.contains("deleteBtn")){
    const id = e.target.dataset.id;
    await supabase.from("posts").delete().eq("id",id);
    loadPosts();
  }
});

/* Create post */
postBtn.onclick = async ()=>{
  let media_url=null, media_type=null;

  if(postMediaEl.files[0]){
    const f = postMediaEl.files[0];
    const path = session.user.id+"/"+Date.now()+"_"+f.name;
    await supabase.storage.from(BUCKET).upload(path,f);
    media_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    media_type = f.type;
  }

  await supabase.from("posts").insert({
    author_id:session.user.id,
    author_name:me.full_name || me.username,
    content:postTextEl.value,
    media_url,
    media_type
  });

  postTextEl.value="";
  postMediaEl.value="";
  loadPosts();
};

/* INIT */
(async()=>{
  session = await requireAuth();
  me = await getMyProfile(session.user.id);
  setTopBar(me);
  loadPosts();
})();
import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const postsEl = document.getElementById("posts");
const postBtn = document.getElementById("postBtn");
const postText = document.getElementById("postText");
const postStatus = document.getElementById("postStatus");
const fab = document.getElementById("fab");

const searchInput = document.getElementById("searchInput");
const goSearch = document.getElementById("goSearch");

goSearch.addEventListener("click", () => {
  const q = (searchInput.value || "").trim();
  window.location.href = "/search/index.html?q=" + encodeURIComponent(q);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") goSearch.click();
});

fab.addEventListener("click", () => postText.focus());

let session = null;
let profile = null;

function fmt(ts){ try { return new Date(ts).toLocaleString(); } catch { return ""; } }
function escapeHtml(s){
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function loadPosts(){
  postsEl.innerHTML = "Loading…";
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, created_at, author_id, author_name")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { postsEl.innerHTML = "Error loading posts: " + escapeHtml(error.message); return; }
  if (!data || data.length === 0){ postsEl.innerHTML = "<div class='muted'>No posts yet.</div>"; return; }

  postsEl.innerHTML = data.map(p => {
    const mine = p.author_id === session.user.id;
    return `
      <div class="post">
        <div class="postTop">
          <div><b>${escapeHtml(p.author_name || "Member")}</b> ${mine ? "<span class='muted'>(you)</span>" : ""}</div>
          <div>${escapeHtml(fmt(p.created_at))}</div>
        </div>
        <div class="postBody">${escapeHtml(p.content)}</div>
      </div>
    `;
  }).join("");
}

async function createPost(){
  const text = (postText.value || "").trim();
  if (!text) return;

  postBtn.disabled = true;
  postStatus.textContent = "Posting…";

  const author_name = profile?.full_name || profile?.name || session.user.email || "Member";

  const { error } = await supabase.from("posts").insert({
    author_id: session.user.id,
    author_name,
    content: text
  });

  postBtn.disabled = false;

  if (error){ postStatus.textContent = "Post failed: " + error.message; return; }

  postText.value = "";
  postStatus.textContent = "Posted ✅";
  setTimeout(() => postStatus.textContent = "", 1500);
  await loadPosts();
}

postBtn.addEventListener("click", createPost);

(async function init(){
  session = await requireAuth();
  if (!session) return;

  profile = await getMyProfile(session.user.id);
  if (!profile || profile.setup_complete !== true){
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  await loadPosts();
})();
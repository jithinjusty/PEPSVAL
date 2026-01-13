import { supabase, getCurrentUser } from "../js/supabase.js";

const feedWrap = document.getElementById("feed");

async function loadFeed() {
  const { data: posts, error } = await supabase
    .from("posts")
    .select(`
      id,
      content,
      media_url,
      created_at,
      profiles (
        full_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Feed error:", error);
    return;
  }

  feedWrap.innerHTML = "";

  if (!posts || posts.length === 0) {
    feedWrap.innerHTML = "<div class='muted'>No posts yet</div>";
    return;
  }

  posts.forEach(p => {
    const post = document.createElement("div");
    post.className = "post";

    const avatar = p.profiles?.avatar_url || "/assets/default-avatar.png";
    const name = p.profiles?.full_name || "Seafarer";

    post.innerHTML = `
      <div class="postHeader">
        <img src="${avatar}" class="postAvatar"/>
        <div class="postName">${name}</div>
        <div class="postTime">${new Date(p.created_at).toLocaleString()}</div>
      </div>

      <div class="postBody">${p.content || ""}</div>

      ${p.media_url ? `<img src="${p.media_url}" class="postMedia"/>` : ""}
    `;

    feedWrap.appendChild(post);
  });
}

loadFeed();
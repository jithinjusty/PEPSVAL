const avatar = document.querySelector(".avatarWrap");
const menu = document.getElementById("profileMenu");
const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const menuName = document.getElementById("menuName");
const menuEmail = document.getElementById("menuEmail");
const logoutBtn = document.getElementById("logoutBtn");

// Toggle menu
avatar.addEventListener("click", e => {
  e.stopPropagation();
  menu.classList.toggle("show");
});

document.addEventListener("click", ()=>menu.classList.remove("show"));

// Supabase auto load
const url = localStorage.getItem("SUPABASE_URL");
const key = localStorage.getItem("SUPABASE_ANON_KEY");

if(url && key){
  import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2").then(({createClient})=>{
    const sb = createClient(url,key);

    sb.auth.getUser().then(async ({data})=>{
      if(!data.user){
        location.href="/auth/login.html";
        return;
      }

      menuEmail.textContent = data.user.email;

      const {data:profile} = await sb
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", data.user.id)
        .single();

      if(profile?.full_name){
        menuName.textContent = profile.full_name;
        avatarFallback.textContent = profile.full_name[0].toUpperCase();
      }

      if(profile?.avatar_url){
        avatarImg.src = profile.avatar_url;
        avatarImg.style.display="block";
        avatarFallback.style.display="none";
      }

      logoutBtn.onclick = async ()=>{
        await sb.auth.signOut();
        location.href="/auth/login.html";
      };
    });
  });
}
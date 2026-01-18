import { supabase } from "/js/supabase.js";

const avatarImg = document.getElementById("avatarImg");
const fullNameEl = document.getElementById("fullName");
const rankEl = document.getElementById("rank");
const messageBtn = document.getElementById("messageBtn");

const params = new URLSearchParams(window.location.search);
const profileId = params.get("id");

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "/auth/login.html";
        return;
    }

    if (!profileId) {
        alert("No profile ID specified.");
        return;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

    if (error || !profile) {
        alert("Profile not found.");
        return;
    }

    // Populate UI
    avatarImg.src = profile.avatar_url || "/assets/logo.webp";
    fullNameEl.textContent = profile.full_name || "Unknown crew";
    rankEl.textContent = profile.rank || profile.job_title || "Maritime Professional";

    // Hide message button if it's my own profile
    if (user.id === profileId) {
        messageBtn.style.display = "none";
    }

    messageBtn.onclick = async () => {
        messageBtn.disabled = true;
        messageBtn.textContent = "Connecting…";

        // 1. Check if conversation already exists
        const { data: myConversations } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("profile_id", user.id);

        const { data: theirConversations } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("profile_id", profileId);

        const common = myConversations?.find(mc =>
            theirConversations?.some(tc => tc.conversation_id === mc.conversation_id)
        );

        if (common) {
            window.location.href = `/messages/index.html?convId=${common.conversation_id}`;
        } else {
            // 2. Create new conversation
            const { data: newConv, error: convErr } = await supabase
                .from("conversations")
                .insert({})
                .select()
                .single();

            if (convErr) {
                alert("Error creating chat: " + convErr.message);
                messageBtn.disabled = false;
                messageBtn.textContent = "Message";
                return;
            }

            // Add participants
            await supabase.from("conversation_participants").insert([
                { conversation_id: newConv.id, profile_id: user.id },
                { conversation_id: newConv.id, profile_id: profileId }
            ]);

            window.location.href = `/messages/index.html?convId=${newConv.id}`;
        }
    };
}

init();

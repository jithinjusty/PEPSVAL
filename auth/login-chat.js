import { supabase } from "/js/supabase.js";

const chatStream = document.getElementById("chatStream");

async function loadStream() {
    if (!chatStream) return;

    const { data, error } = await supabase
        .from("community_chat")
        .select(`
      *,
      profiles:profile_id (full_name)
    `)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Stream error:", error);
        chatStream.innerHTML = '<div class="loading-chat">Offline. Log in to chat.</div>';
        return;
    }

    renderStream(data || []);
    subscribeToStream();
}

function renderStream(messages) {
    chatStream.innerHTML = "";
    // Newest at bottom for a natural chat flow
    [...messages].reverse().forEach(m => {
        appendMessage(m);
    });
}

function appendMessage(m) {
    if (!chatStream) return;

    const div = document.createElement("div");
    div.className = "chat-item";

    const name = m.profiles?.full_name || "Crew Member";
    div.innerHTML = `
    <div class="author">${name}</div>
    <div class="text">${m.content}</div>
  `;

    chatStream.appendChild(div);

    // Auto scroll if user is near bottom
    const isNearBottom = chatStream.scrollHeight - chatStream.scrollTop - chatStream.clientHeight < 100;
    if (isNearBottom) {
        chatStream.scrollTop = chatStream.scrollHeight;
    }
}

function subscribeToStream() {
    supabase.channel('public_community_live')
        .on('postgres_changes', { event: 'INSERT', table: 'community_chat' }, async (payload) => {
            const { data: newMsg } = await supabase
                .from("community_chat")
                .select(`*, profiles:profile_id (full_name)`)
                .eq("id", payload.new.id)
                .single();

            if (newMsg) {
                appendMessage(newMsg);
            }
        })
        .subscribe();
}

loadStream();

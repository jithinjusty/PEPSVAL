import { supabase } from "/js/supabase.js";
import { toggleTheme, getCurrentTheme } from "/js/theme.js";

const themeToggle = document.getElementById("themeToggle");
const logoutBtn = document.getElementById("logoutBtn");
const deleteAccBtn = document.getElementById("deleteAccBtn");
const supportForm = document.getElementById("supportForm");

// Contact Form
const contactForm = document.getElementById("contactForm");
const primaryEmail = document.getElementById("primaryEmail");
const secondaryEmails = document.getElementById("secondaryEmails");
const primaryPhone = document.getElementById("primaryPhone");
const secondaryPhones = document.getElementById("secondaryPhones");
const contactMsg = document.getElementById("contactMsg");

// Password Form
const passwordForm = document.getElementById("passwordForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const passwordMsg = document.getElementById("passwordMsg");

let user = null;

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    // Set toggle state based on current theme
    const theme = getCurrentTheme();
    if (themeToggle) {
        themeToggle.checked = (theme === 'dark');
    }

    // Auth check
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user;

    if (!user) {
        window.location.href = "/auth/login.html";
        return;
    }

    // Populate initial data
    primaryEmail.value = user.email;
    loadProfileData();
});

async function loadProfileData() {
    const { data, error } = await supabase
        .from("profiles")
        .select("phone, secondary_emails, secondary_phones")
        .eq("id", user.id)
        .single();

    if (data) {
        primaryPhone.value = data.phone || "";
        secondaryEmails.value = data.secondary_emails || "";
        secondaryPhones.value = data.secondary_phones || "";
    }
}

// Theme Toggle
themeToggle?.addEventListener("change", () => {
    toggleTheme();
});

// Contact Form Submission
contactForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("saveContactBtn");

    showMsg(contactMsg, "Saving...", "success");
    saveBtn.disabled = true;

    const updates = {
        phone: primaryPhone.value.trim(),
        secondary_emails: secondaryEmails.value.trim(),
        secondary_phones: secondaryPhones.value.trim(),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

    saveBtn.disabled = false;

    if (error) {
        showMsg(contactMsg, "Error: " + error.message, "error");
    } else {
        showMsg(contactMsg, "Contact details updated successfully!", "success");
    }
});

// Password Form Submission
passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("changePassBtn");

    const pass = newPassword.value;
    const conf = confirmPassword.value;

    if (pass.length < 6) {
        showMsg(passwordMsg, "Password must be at least 6 characters.", "error");
        return;
    }

    if (pass !== conf) {
        showMsg(passwordMsg, "Passwords do not match.", "error");
        return;
    }

    showMsg(passwordMsg, "Updating...", "success");
    btn.disabled = true;

    const { error } = await supabase.auth.updateUser({ password: pass });

    btn.disabled = false;

    if (error) {
        showMsg(passwordMsg, "Error: " + error.message, "error");
    } else {
        showMsg(passwordMsg, "Password updated successfully!", "success");
        newPassword.value = "";
        confirmPassword.value = "";
    }
});

// Support Form
supportForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = document.getElementById("supportText").value.trim();
    if (!text) {
        alert("Please describe your issue first.");
        return;
    }

    const email = "support@pepsval.com";
    const subject = encodeURIComponent("PEPSVAL Support Query");
    const body = encodeURIComponent(text);

    // Use mailto for direct client sending
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

    alert("Opening your email client to send the query...");
});

// Logout
const logoutFn = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
};
logoutBtn?.addEventListener("click", logoutFn);
document.getElementById("sidebarLogout")?.addEventListener("click", logoutFn);

// Delete Account
deleteAccBtn?.addEventListener("click", async () => {
    const confirmed = confirm("Are you sure you want to PERMANENTLY delete your account?");
    if (confirmed) {
        const doubleConfirmed = prompt("Type 'DELETE' to confirm:");
        if (doubleConfirmed === "DELETE") {
            // Note: Requires backend/RPC for self-deletion in many Supabase setups
            alert("Delete request logged. Please contact support@pepsval.com to finalize.");
        }
    }
});

function showMsg(el, text, type) {
    el.textContent = text;
    el.className = `msg-box ${type}`;
    el.style.display = "block";
    if (type === "success") {
        setTimeout(() => { el.style.display = "none"; }, 4000);
    }
}

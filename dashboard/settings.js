import { supabase } from "/js/supabase.js";
import { toggleTheme, getCurrentTheme } from "/js/theme.js";

const themeToggle = document.getElementById("themeToggle");
const logoutBtn = document.getElementById("logoutBtn");
const deleteAccBtn = document.getElementById("deleteAccBtn");
const supportForm = document.getElementById("supportForm");

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    // Set toggle state based on current theme
    const theme = getCurrentTheme();
    if (themeToggle) {
        themeToggle.checked = (theme === 'dark');
    }

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "/auth/login.html";
        return;
    }
});

// Theme Toggle
themeToggle?.addEventListener("change", () => {
    toggleTheme();
});

// Support Form
supportForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("supportText").value.trim();
    if (!text) return;

    // Simulated support submission
    const btn = supportForm.querySelector("button");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";

    // In a real app, we might insert into a 'support_tickets' table
    setTimeout(() => {
        alert("Your query has been sent to the support team! We will get back to you soon.");
        document.getElementById("supportText").value = "";
        btn.disabled = false;
        btn.textContent = originalText;
    }, 1500);
});

// Logout
logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
});

// Delete Account
deleteAccBtn?.addEventListener("click", async () => {
    const confirmed = confirm("Are you sure you want to PERMANENTLY delete your account? This action cannot be undone and all your profile data, posts, and messages will be lost.");

    if (confirmed) {
        const doubleConfirmed = prompt("To confirm, please type 'DELETE' in the box below:");
        if (doubleConfirmed === "DELETE") {
            // Note: Supabase client-side API doesn't allow users to delete themselves directly for security.
            // Usually this requires a database function (RPC) or a dedicated Edge Function.
            alert("For security reasons, please contact support@pepsval.com to complete your account deletion request. Your request has been logged.");

            // Log the request to a simulated audit log or just alert.
            console.log("Account deletion requested by user.");
        }
    }
});

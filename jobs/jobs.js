import { requireAuth, getMyProfile } from "/js/guard.js";

(async () => {
  const session = await requireAuth();
  if (!session) return;

  const mini = await getMyProfile(session.user.id);
  if (!mini || mini.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
  }
})();
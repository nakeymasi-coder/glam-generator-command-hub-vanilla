(function () {
  "use strict";

  const RECOVERY_FLAG = "glam_password_recovery_pending";
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const recoveryFromLink = hashParams.get("type") === "recovery";

  // Supabase can clean the recovery hash very quickly. Remember the recovery
  // state before that happens so the password screen survives any auth refresh.
  if (recoveryFromLink) {
    sessionStorage.setItem(RECOVERY_FLAG, "1");
  }

  const recoveryPending =
    recoveryFromLink || sessionStorage.getItem(RECOVERY_FLAG) === "1";

  if (!recoveryPending) return;

  function showRecoveryScreen() {
    if (document.getElementById("glamRecoveryOverlay")) return;

    const config = window.GLAM_CONFIG || {};

    if (
      !window.supabase ||
      !config.SUPABASE_URL ||
      !config.SUPABASE_ANON_KEY
    ) {
      return;
    }

    const recoveryClient = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
    );

    const overlay = document.createElement("div");
    overlay.id = "glamRecoveryOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:rgba(10,20,30,.82);display:grid;place-items:center;padding:24px;backdrop-filter:blur(10px)";

    overlay.innerHTML = `
      <div style="width:min(520px,100%);background:#fff;border:1px solid #b9ddf8;border-radius:24px;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.30);font-family:Arial,sans-serif;color:#171A1E">
        <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#168FEA;margin-bottom:8px">ACCOUNT SECURITY</div>
        <h2 style="margin:0 0 10px;font-size:30px">Set New Password</h2>
        <p style="margin:0 0 20px;color:#5b6b79;line-height:1.55">Enter a new password for your GLAM Generator Command Hub account.</p>

        <form id="glamRecoveryForm">
          <label style="display:block;font-weight:700;margin-bottom:14px">
            New Password
            <input id="glamRecoveryPassword" type="password" minlength="8" autocomplete="new-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:1px solid #c9d9e6;border-radius:12px;font-size:16px">
          </label>

          <label style="display:block;font-weight:700;margin-bottom:18px">
            Confirm New Password
            <input id="glamRecoveryConfirm" type="password" minlength="8" autocomplete="new-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:1px solid #c9d9e6;border-radius:12px;font-size:16px">
          </label>

          <div id="glamRecoveryMessage" style="min-height:22px;margin-bottom:10px;color:#b42318;font-size:14px"></div>

          <button id="glamRecoverySubmit" type="submit" style="width:100%;border:0;border-radius:14px;padding:14px 18px;background:#168FEA;color:#fff;font-weight:800;font-size:16px;cursor:pointer">
            Save New Password
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    // If another part of the app changes screens while Supabase finishes the
    // recovery sign-in, keep this security screen above the dashboard.
    const observer = new MutationObserver(() => {
      if (
        sessionStorage.getItem(RECOVERY_FLAG) === "1" &&
        !document.getElementById("glamRecoveryOverlay")
      ) {
        document.body.appendChild(overlay);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document
      .getElementById("glamRecoveryForm")
      .addEventListener("submit", async (event) => {
        event.preventDefault();

        const password = document.getElementById("glamRecoveryPassword").value;
        const confirmPassword = document.getElementById(
          "glamRecoveryConfirm",
        ).value;
        const message = document.getElementById("glamRecoveryMessage");
        const button = document.getElementById("glamRecoverySubmit");

        if (password.length < 8) {
          message.textContent = "Your new password must be at least 8 characters.";
          return;
        }

        if (password !== confirmPassword) {
          message.textContent = "The passwords do not match.";
          return;
        }

        button.disabled = true;
        button.textContent = "Saving...";
        message.textContent = "";

        const { data: sessionData } = await recoveryClient.auth.getSession();

        if (!sessionData || !sessionData.session) {
          message.textContent =
            "Your reset session is not ready yet. Please wait a moment and try again.";
          button.disabled = false;
          button.textContent = "Save New Password";
          return;
        }

        const { error } = await recoveryClient.auth.updateUser({ password });

        if (error) {
          message.textContent = error.message || "Unable to change your password.";
          button.disabled = false;
          button.textContent = "Save New Password";
          return;
        }

        sessionStorage.removeItem(RECOVERY_FLAG);
        observer.disconnect();
        history.replaceState(null, "", window.location.pathname + window.location.search);

        overlay.innerHTML = `
          <div style="width:min(520px,100%);background:#fff;border:1px solid #b9ddf8;border-radius:24px;padding:32px;text-align:center;font-family:Arial,sans-serif;color:#171A1E">
            <h2 style="margin-top:0">Password Updated</h2>
            <p style="color:#5b6b79">Your new password has been saved successfully.</p>
            <button id="glamRecoveryDone" type="button" style="border:0;border-radius:14px;padding:13px 22px;background:#168FEA;color:#fff;font-weight:800;cursor:pointer">Continue to Dashboard</button>
          </div>
        `;

        document
          .getElementById("glamRecoveryDone")
          .addEventListener("click", () => {
            overlay.remove();
            window.location.reload();
          });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showRecoveryScreen, {
      once: true,
    });
  } else {
    showRecoveryScreen();
  }
})();

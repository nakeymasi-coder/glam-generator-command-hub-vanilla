(function () {
  "use strict";

  const STORAGE_KEY = "glam_command_hub_preview";
  const config = window.GLAM_CONFIG || {};

  if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;

  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
  );

  const fieldIds = [
    "promptTitle",
    "promptGoal",
    "promptAudience",
    "promptStyle",
    "promptSubject",
    "promptInclude",
    "promptAvoid",
    "promptFormat",
  ];

  let saveTimer = null;

  function readWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data.prompts)) data.prompts = [];
      if (!data.studio_settings || typeof data.studio_settings !== "object") {
        data.studio_settings = {};
      }
      return data;
    } catch (_error) {
      return { prompts: [], studio_settings: {} };
    }
  }

  function writeWorkspace(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function getUser() {
    const { data } = await client.auth.getSession();
    return data?.session?.user || null;
  }

  async function saveWorkspaceNow(workspace) {
    const user = await getUser();
    if (!user) return;

    const { error } = await client.from("workspace_state").upsert(
      {
        user_id: user.id,
        data: workspace,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Prompt Studio private save failed:", error);
    }
  }

  function collectSettings() {
    const settings = {};
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) settings[id] = el.value;
    });
    return settings;
  }

  function restoreSettings() {
    const workspace = readWorkspace();
    const settings = workspace.studio_settings || {};

    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || settings[id] == null) return;
      el.value = settings[id];
    });
  }

  function scheduleSettingsSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const workspace = readWorkspace();
      workspace.studio_settings = collectSettings();
      writeWorkspace(workspace);
      await saveWorkspaceNow(workspace);
    }, 350);
  }

  function attachStudio() {
    const form = document.getElementById("promptStudioForm");
    if (!form || form.dataset.privateStudioBound === "true") return;

    form.dataset.privateStudioBound = "true";
    restoreSettings();

    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", scheduleSettingsSave);
      el.addEventListener("change", scheduleSettingsSave);
    });

    const saveBtn = document.getElementById("savePromptBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        setTimeout(async () => {
          const workspace = readWorkspace();
          workspace.studio_settings = collectSettings();
          writeWorkspace(workspace);
          await saveWorkspaceNow(workspace);
        }, 50);
      });
    }

    const clearBtn = document.getElementById("clearPromptStudioBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        setTimeout(async () => {
          const workspace = readWorkspace();
          workspace.studio_settings = {};
          writeWorkspace(workspace);
          await saveWorkspaceNow(workspace);
        }, 50);
      });
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const nav = event.target.closest("#mainNav [data-page='studio']");
      if (!nav) return;
      setTimeout(attachStudio, 80);
      setTimeout(attachStudio, 250);
    },
    true,
  );

  const container = document.getElementById("pageContainer");
  if (container) {
    new MutationObserver(() => attachStudio()).observe(container, {
      childList: true,
      subtree: true,
    });
  }
})();

(function () {
  "use strict";

  const STORAGE_KEY = "glam_command_hub_preview";
  const config = window.GLAM_CONFIG || {};
  const originalSetItem = Storage.prototype.setItem;

  let workspaceClient = null;
  let workspaceUser = null;
  let cloudData = {
    prompts: [],
    projects: [],
    ideas: [],
    generators: [],
    usage: [],
  };
  let syncTimer = null;

  function readLocalWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLocalWorkspace(data) {
    originalSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(data));
  }

  function normalizeCloudData(value) {
    const data = value && typeof value === "object" ? value : {};
    return {
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : [],
      generators: Array.isArray(data.generators) ? data.generators : [],
      usage: Array.isArray(data.usage) ? data.usage : [],
    };
  }

  async function saveWorkspaceToSupabase(data) {
    if (!workspaceClient || !workspaceUser) return;

    cloudData = normalizeCloudData(data);

    const { error } = await workspaceClient.from("workspace_state").upsert(
      {
        user_id: workspaceUser.id,
        data: cloudData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Private workspace cloud sync failed:", error);
    }
  }

  function installWorkspaceSync() {
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);

      if (this !== localStorage || key !== STORAGE_KEY || !workspaceUser) return;

      let parsed;
      try {
        parsed = JSON.parse(value || "{}");
      } catch (_error) {
        return;
      }

      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        saveWorkspaceToSupabase(parsed);
      }, 250);
    };
  }

  function loadMainApp() {
    if (document.querySelector('script[data-glam-main-app="true"]')) return;

    const script = document.createElement("script");
    script.src = "script.js";
    script.dataset.glamMainApp = "true";
    document.body.appendChild(script);
  }

  async function bootstrap() {
    if (
      !window.supabase ||
      !config.SUPABASE_URL ||
      !config.SUPABASE_ANON_KEY
    ) {
      loadMainApp();
      return;
    }

    try {
      workspaceClient = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY,
      );

      const { data: sessionData } = await workspaceClient.auth.getSession();
      workspaceUser = sessionData?.session?.user || null;

      if (!workspaceUser) {
        loadMainApp();
        return;
      }

      const localWorkspace = normalizeCloudData(readLocalWorkspace());
      const { data: row, error } = await workspaceClient
        .from("workspace_state")
        .select("data")
        .eq("user_id", workspaceUser.id)
        .maybeSingle();

      if (error) throw error;

      if (row?.data) {
        cloudData = normalizeCloudData(row.data);
        writeLocalWorkspace(cloudData);
      } else {
        cloudData = localWorkspace;
        await saveWorkspaceToSupabase(cloudData);
      }

      installWorkspaceSync();
    } catch (error) {
      console.error("Private workspace cloud bootstrap failed:", error);
    }

    loadMainApp();
  }

  bootstrap();
})();

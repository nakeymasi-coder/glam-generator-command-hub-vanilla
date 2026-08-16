(function () {
  "use strict";

  const STORAGE_KEY = "glam_command_hub_preview";
  const OWNER_KEY = "glam_workspace_owner";
  const config = window.GLAM_CONFIG || {};
  const originalSetItem = Storage.prototype.setItem;

  let workspaceClient = null;
  let workspaceUser = null;
  let workspaceReadyUserId = null;
  let cloudData = emptyWorkspace();
  let syncTimer = null;
  let syncInstalled = false;

  function emptyWorkspace() {
    return {
      prompts: [],
      projects: [],
      ideas: [],
      generators: [],
      favorites: [],
      mockups: [],
      storyboards: [],
      ugc: [],
      stationery: [],
      daily_history: [],
      usage: [],
    };
  }

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

  function setOwner(userId) {
    originalSetItem.call(localStorage, OWNER_KEY, userId || "");
  }

  function normalizeCloudData(value) {
    const data = value && typeof value === "object" ? value : {};
    return {
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : [],
      generators: Array.isArray(data.generators) ? data.generators : [],
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      mockups: Array.isArray(data.mockups) ? data.mockups : [],
      storyboards: Array.isArray(data.storyboards) ? data.storyboards : [],
      ugc: Array.isArray(data.ugc) ? data.ugc : [],
      stationery: Array.isArray(data.stationery) ? data.stationery : [],
      daily_history: Array.isArray(data.daily_history) ? data.daily_history : [],
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
    if (syncInstalled) return;
    syncInstalled = true;

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

  async function activateWorkspaceForUser(user, reloadAfter) {
    if (!user || !workspaceClient) return;
    if (workspaceReadyUserId === user.id) return;

    const previousOwner = localStorage.getItem(OWNER_KEY) || "";
    const localWorkspace = normalizeCloudData(readLocalWorkspace());

    workspaceUser = user;

    const { data: row, error } = await workspaceClient
      .from("workspace_state")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Private workspace load failed:", error);
      return;
    }

    if (row?.data) {
      cloudData = normalizeCloudData(row.data);
    } else if (!previousOwner || previousOwner === user.id) {
      cloudData = localWorkspace;
      await saveWorkspaceToSupabase(cloudData);
    } else {
      cloudData = emptyWorkspace();
      await saveWorkspaceToSupabase(cloudData);
    }

    writeLocalWorkspace(cloudData);
    setOwner(user.id);
    workspaceReadyUserId = user.id;

    if (reloadAfter) {
      window.location.reload();
    }
  }

  function loadMainApp() {
    if (document.querySelector('script[data-glam-main-app="true"]')) return;

    const script = document.createElement("script");
    script.src = "script.js";
    script.dataset.glamMainApp = "true";

    script.addEventListener("load", () => {
      const isRecovery = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      ).get("type") === "recovery";

      if (document.readyState !== "loading" && !isRecovery) {
        document.dispatchEvent(new Event("DOMContentLoaded"));
      }
    });

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

      installWorkspaceSync();

      const { data: sessionData } = await workspaceClient.auth.getSession();
      const initialUser = sessionData?.session?.user || null;

      if (initialUser) {
        await activateWorkspaceForUser(initialUser, false);
      }

      workspaceClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          workspaceUser = null;
          workspaceReadyUserId = null;
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => {
            activateWorkspaceForUser(session.user, true).catch((error) =>
              console.error("Private workspace sign-in sync failed:", error),
            );
          }, 0);
        }
      });
    } catch (error) {
      console.error("Private workspace bootstrap failed:", error);
    }

    loadMainApp();
  }

  bootstrap();
})();

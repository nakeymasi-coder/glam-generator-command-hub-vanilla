(function () {
  "use strict";

  const STORAGE_KEY = "glam_command_hub_preview";
  const appConfig = window.GLAM_CONFIG || {};
  const sectionMap = {
    favorites: { title: "Favorite Styles", singular: "Style" },
    mockups: { title: "Saved Mockups", singular: "Mockup" },
    storyboards: { title: "Storyboards", singular: "Storyboard" },
    ugc: { title: "UGC Content", singular: "UGC Item" },
    stationery: { title: "Stationery", singular: "Stationery Item" },
  };

  const workspaceClient =
    window.supabase && appConfig.SUPABASE_URL && appConfig.SUPABASE_ANON_KEY
      ? window.supabase.createClient(
          appConfig.SUPABASE_URL,
          appConfig.SUPABASE_ANON_KEY,
        )
      : null;

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
      usage: [],
    };
  }

  function readWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return Object.assign(emptyWorkspace(), data && typeof data === "object" ? data : {});
    } catch (_error) {
      return emptyWorkspace();
    }
  }

  function writeWorkspace(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function saveWorkspaceDirectly(data) {
    writeWorkspace(data);

    if (!workspaceClient) {
      throw new Error("Supabase is not connected.");
    }

    const { data: sessionData, error: sessionError } =
      await workspaceClient.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user;
    if (!user) {
      throw new Error("Please log in again before saving.");
    }

    const { error } = await workspaceClient.from("workspace_state").upsert(
      {
        user_id: user.id,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch (_error) {
      return "";
    }
  }

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function closeModal() {
    document.getElementById("modal")?.classList.add("hidden");
  }

  function openModal(html) {
    const body = document.getElementById("modalBody");
    const modal = document.getElementById("modal");
    if (!body || !modal) return;
    body.innerHTML = html;
    modal.classList.remove("hidden");
  }

  function renderSection(key) {
    const config = sectionMap[key];
    const container = document.getElementById("pageContainer");
    if (!config || !container) return;

    const workspace = readWorkspace();
    const items = Array.isArray(workspace[key]) ? workspace[key] : [];

    document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === key);
    });

    container.innerHTML = `
      <div class="page-header">
        <p>PRIVATE WORKSPACE</p>
        <h1>${escapeHtml(config.title)}</h1>
        <span>Everything saved here belongs to the signed-in account.</span>
      </div>
      <section class="card">
        <div class="card-head">
          <h3>${escapeHtml(config.title)}</h3>
          <button id="workspaceSectionAdd" class="btn btn-primary" type="button">Add ${escapeHtml(config.singular)}</button>
        </div>
        <div class="item-list">
          ${items.length ? items.map((item) => `
            <div class="item-row">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                ${item.body ? `<div style="color:var(--muted);margin-top:5px;line-height:1.45">${escapeHtml(item.body)}</div>` : ""}
                <small>${formatDate(item.created_at)}</small>
              </div>
              <button class="link-btn" data-workspace-delete="${escapeHtml(item.id)}">Delete</button>
            </div>
          `).join("") : `<div class="empty-state">Nothing saved in ${escapeHtml(config.title)} yet.</div>`}
        </div>
      </section>`;

    document.getElementById("workspaceSectionAdd")?.addEventListener("click", () => {
      openModal(`
        <div class="section-kicker">NEW ${escapeHtml(config.singular.toUpperCase())}</div>
        <h2>Add ${escapeHtml(config.singular)}</h2>
        <form id="workspaceSectionForm">
          <label>Title<input id="workspaceSectionTitle" required maxlength="120" placeholder="Give this ${escapeHtml(config.singular.toLowerCase())} a name"></label>
          <label>Notes<textarea id="workspaceSectionBody" placeholder="Add notes or details..."></textarea></label>
          <button id="workspaceSectionSave" class="btn btn-primary btn-full" type="submit">Save</button>
        </form>`);

      document.getElementById("workspaceSectionForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("workspaceSectionSave");
        const latest = readWorkspace();
        if (!Array.isArray(latest[key])) latest[key] = [];

        latest[key].unshift({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
          title: document.getElementById("workspaceSectionTitle").value.trim(),
          body: document.getElementById("workspaceSectionBody").value.trim(),
          created_at: new Date().toISOString(),
        });

        if (button) {
          button.disabled = true;
          button.textContent = "Saving...";
        }

        try {
          await saveWorkspaceDirectly(latest);
          closeModal();
          renderSection(key);
          toast(`${config.singular} saved to your private workspace.`);
        } catch (error) {
          if (button) {
            button.disabled = false;
            button.textContent = "Save";
          }
          toast(error.message || `Unable to save ${config.singular.toLowerCase()}.`);
          console.error("Private workspace section save failed:", error);
        }
      });
    });

    container.querySelectorAll("[data-workspace-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const latest = readWorkspace();
        const before = Array.isArray(latest[key]) ? latest[key].slice() : [];
        latest[key] = before.filter((item) => item.id !== button.dataset.workspaceDelete);

        try {
          await saveWorkspaceDirectly(latest);
          renderSection(key);
          toast(`${config.singular} deleted.`);
        } catch (error) {
          latest[key] = before;
          writeWorkspace(latest);
          toast(error.message || `Unable to delete ${config.singular.toLowerCase()}.`);
          console.error("Private workspace section delete failed:", error);
        }
      });
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      const nav = event.target.closest("#mainNav [data-page]");
      if (!nav || !sectionMap[nav.dataset.page]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      renderSection(nav.dataset.page);
    },
    true,
  );

  const toastNode = document.getElementById("toast");
  if (toastNode) {
    new MutationObserver(() => {
      const replacements = [
        ["saved locally for preview.", "saved to your private workspace."],
        ["saved in your private preview workspace.", "saved in your private workspace."],
      ];
      let text = toastNode.textContent || "";
      for (const [from, to] of replacements) text = text.replace(from, to);
      if (text !== toastNode.textContent) toastNode.textContent = text;
    }).observe(toastNode, { childList: true, characterData: true, subtree: true });
  }
})();

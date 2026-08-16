(function () {
  "use strict";

  const STORAGE_KEY = "glam_command_hub_preview";
  const config = window.GLAM_CONFIG || {};

  if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;

  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
  );

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[c]);
  }

  function readWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data.daily_history)) data.daily_history = [];
      return data;
    } catch (_error) {
      return { daily_history: [] };
    }
  }

  function writeWorkspace(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3200);
  }

  async function getSessionUser() {
    const { data } = await client.auth.getSession();
    return data?.session?.user || null;
  }

  async function loadProfile(user) {
    const fallback = {
      preferred_name: "Creator",
      daily_glam: true,
      faith_based: false,
      affirmations: true,
      general_encouragement: true,
      business_motivation: true,
    };

    if (!user) return fallback;

    const { data } = await client
      .from("profiles")
      .select("preferred_name,daily_glam,faith_based,affirmations,general_encouragement,business_motivation")
      .eq("id", user.id)
      .maybeSingle();

    return Object.assign(fallback, data || {});
  }

  function todayMessage(profile) {
    const name = profile.preferred_name || "Creator";
    const message = `Good morning, ${name}. You’re allowed to build this one strong piece at a time.`;
    const verse = profile.faith_based
      ? "Commit your work to the Lord, and your plans will be established. — Proverbs 16:3"
      : "";
    return { message, verse };
  }

  async function saveHistoryEntry(profile) {
    const user = await getSessionUser();
    if (!user) return toast("Please log in again.");

    const workspace = readWorkspace();
    const current = todayMessage(profile);
    const today = new Date().toISOString().slice(0, 10);

    const exists = workspace.daily_history.some((item) => item.date === today);
    if (exists) return toast("Today’s Daily Glam is already saved.");

    workspace.daily_history.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
      date: today,
      message: current.message,
      verse: current.verse,
      saved_at: new Date().toISOString(),
    });

    writeWorkspace(workspace);

    const { error } = await client.from("workspace_state").upsert(
      {
        user_id: user.id,
        data: workspace,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) return toast(error.message || "Unable to save Daily Glam.");

    toast("Today’s Daily Glam saved to your private history.");
    renderDailyGlam();
  }

  async function savePreferences(event, profile) {
    event.preventDefault();
    const user = await getSessionUser();
    if (!user) return toast("Please log in again.");

    const payload = {
      id: user.id,
      email: user.email,
      preferred_name: document.getElementById("dgPreferredName").value.trim() || "Creator",
      daily_glam: document.getElementById("dgDaily").checked,
      affirmations: document.getElementById("dgAffirmations").checked,
      general_encouragement: document.getElementById("dgEncouragement").checked,
      business_motivation: document.getElementById("dgBusiness").checked,
      faith_based: document.getElementById("dgFaith").checked,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from("profiles").upsert(payload);
    if (error) return toast(error.message || "Unable to save preferences.");

    toast("Daily Glam preferences saved to your private account.");
    renderDailyGlam();
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return toast("Text-to-speech is not supported by this browser.");
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function renderDailyGlam() {
    const container = document.getElementById("pageContainer");
    if (!container) return;

    const user = await getSessionUser();
    if (!user) return;

    const profile = await loadProfile(user);
    const current = todayMessage(profile);
    const workspace = readWorkspace();
    const history = Array.isArray(workspace.daily_history) ? workspace.daily_history : [];

    document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === "daily");
    });

    container.innerHTML = `
      <div class="page-header">
        <p>PRIVATE WORKSPACE</p>
        <h1>Daily Glam</h1>
        <span>Personal encouragement, faith preferences, and your private Daily Glam history.</span>
      </div>

      <div class="content-grid">
        <section class="card">
          <div class="card-head"><h3>Today</h3><span class="badge">For ${escapeHtml(profile.preferred_name || "Creator")}</span></div>
          <p class="daily-message">${escapeHtml(current.message)}</p>
          ${current.verse ? `<p class="verse">${escapeHtml(current.verse)}</p>` : ""}
          <div class="form-actions">
            <button id="dgPlay" class="btn btn-secondary" type="button">Play</button>
            <button id="dgSaveToday" class="btn btn-primary" type="button">Save Today’s Glam</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>Preferences</h3><span class="badge">Private</span></div>
          <form id="dgPreferencesForm">
            <label>Preferred name<input id="dgPreferredName" value="${escapeHtml(profile.preferred_name || "")}"></label>
            <label class="switch-row"><span>Daily Glam messages</span><input id="dgDaily" type="checkbox" ${profile.daily_glam ? "checked" : ""}></label>
            <label class="switch-row"><span>Affirmations</span><input id="dgAffirmations" type="checkbox" ${profile.affirmations ? "checked" : ""}></label>
            <label class="switch-row"><span>General encouragement</span><input id="dgEncouragement" type="checkbox" ${profile.general_encouragement ? "checked" : ""}></label>
            <label class="switch-row"><span>Business motivation</span><input id="dgBusiness" type="checkbox" ${profile.business_motivation ? "checked" : ""}></label>
            <label class="switch-row"><span>Bible verses / faith-based content</span><input id="dgFaith" type="checkbox" ${profile.faith_based ? "checked" : ""}></label>
            <div class="form-actions"><button class="btn btn-primary" type="submit">Save Preferences</button></div>
          </form>
        </section>
      </div>

      <section class="card" style="margin-top:20px;">
        <div class="card-head"><h3>Daily Glam History</h3><span class="badge">${history.length} Saved</span></div>
        <div class="item-list">
          ${history.length ? history.map((item) => `
            <div class="item-row">
              <div>
                <strong>${escapeHtml(item.date || "Saved Daily Glam")}</strong>
                <div style="color:var(--muted);margin-top:5px;line-height:1.45">${escapeHtml(item.message || "")}</div>
                ${item.verse ? `<div style="color:var(--muted);margin-top:5px;line-height:1.45">${escapeHtml(item.verse)}</div>` : ""}
              </div>
            </div>`).join("") : `<div class="empty-state">No Daily Glam messages saved yet.</div>`}
        </div>
      </section>`;

    document.getElementById("dgPlay")?.addEventListener("click", () => {
      speak([current.message, current.verse].filter(Boolean).join(" "));
    });
    document.getElementById("dgSaveToday")?.addEventListener("click", () => saveHistoryEntry(profile));
    document.getElementById("dgPreferencesForm")?.addEventListener("submit", (event) => savePreferences(event, profile));
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("#mainNav [data-page='daily']");
    if (!nav) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderDailyGlam().catch((error) => {
      console.error("Daily Glam render failed:", error);
      toast("Unable to open Daily Glam.");
    });
  }, true);
})();

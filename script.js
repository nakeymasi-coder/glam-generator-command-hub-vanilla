/* GLAM Generator Command Hub — plain JavaScript edition
   Works when index.html is opened directly. No React/Vite/npm required.
*/
(function () {
  "use strict";

  const config = window.GLAM_CONFIG || {};
  const hasSupabaseConfig = Boolean(
    config.SUPABASE_URL && config.SUPABASE_ANON_KEY,
  );
  const supabaseClient =
    hasSupabaseConfig && window.supabase
      ? window.supabase.createClient(
          config.SUPABASE_URL,
          config.SUPABASE_ANON_KEY,
        )
      : null;

  const state = {
    mode: "login",
    session: null,
    user: null,
    profile: {
      preferred_name: localStorage.getItem("glam_preview_name") || "Glam",
      daily_glam: true,
      faith_based: false,
      affirmations: true,
      general_encouragement: true,
      business_motivation: true,
    },
    preview: false,
    isAdmin: false,
    currentPage: "dashboard",
    local: loadLocalData(),
  };

  const pageMeta = {
    vault: [
      "Generator Vault",
      "Your private collection of generator tools and concepts.",
    ],
    prompts: [
      "Saved Prompts",
      "Save, organize, and return to prompts created in your workspace.",
    ],
    projects: [
      "Generator Projects",
      "Build and organize generator projects without mixing accounts.",
    ],
    ideas: [
      "Idea Brain",
      "Capture creative conversations and develop ideas in one place.",
    ],
    studio: [
      "Universal Prompt Studio",
      "Build reusable prompt frameworks and personal prompt settings.",
    ],
    favorites: [
      "Favorite Styles",
      "Keep the styles and creative directions you reach for most.",
    ],
    mockups: [
      "Saved Mockups",
      "Store mockup concepts and generated mockup prompts.",
    ],
    storyboards: ["Storyboards", "Organize scene ideas and visual sequences."],
    ugc: [
      "UGC Content",
      "Save user-generated-content ideas, scripts, hooks, and concepts.",
    ],
    stationery: [
      "Stationery",
      "Keep notebook, planner, card, and stationery prompt concepts.",
    ],
    usage: [
      "AI Usage",
      "Track account-level AI requests and future credit allowances.",
    ],
  };

  const authView = document.getElementById("authView");
  const appView = document.getElementById("appView");
  const pageContainer = document.getElementById("pageContainer");
  const connectionNotice = document.getElementById("connectionNotice");

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    updateConnectionNotice();

    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) await enterAuthenticatedApp(data.session);
      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) await enterAuthenticatedApp(session);
        else if (!state.preview) showAuth();
      });
    }
  }

  function bindEvents() {
    document
      .getElementById("loginTab")
      .addEventListener("click", () => setAuthMode("login"));
    document
      .getElementById("signupTab")
      .addEventListener("click", () => setAuthMode("signup"));
    document
      .getElementById("authForm")
      .addEventListener("submit", handleAuthSubmit);
    document
      .getElementById("forgotBtn")
      .addEventListener("click", forgotPassword);
    document
      .getElementById("previewBtn")
      .addEventListener("click", enterPreview);
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("menuBtn").addEventListener("click", openMenu);
    document
      .getElementById("closeMenuBtn")
      .addEventListener("click", closeMenu);
    document
      .getElementById("mobileOverlay")
      .addEventListener("click", closeMenu);
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
    document.getElementById("mainNav").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (btn) navigate(btn.dataset.page);
    });
    document
      .getElementById("adminNavBtn")
      .addEventListener("click", () => navigate("admin"));
  }

  function setAuthMode(mode) {
    state.mode = mode;
    document
      .getElementById("loginTab")
      .classList.toggle("active", mode === "login");
    document
      .getElementById("signupTab")
      .classList.toggle("active", mode === "signup");
    document.getElementById("authSubmit").textContent =
      mode === "login" ? "Log In" : "Create Account";
    document
      .getElementById("rememberRow")
      .classList.toggle("hidden", mode === "signup");
    document
      .getElementById("passwordInput")
      .setAttribute(
        "autocomplete",
        mode === "login" ? "current-password" : "new-password",
      );
  }

  function updateConnectionNotice() {
    if (supabaseClient) {
      connectionNotice.innerHTML =
        "<strong>Supabase connected.</strong> Account actions will use your secure database and Row Level Security policies.";
      connectionNotice.style.borderColor = "rgba(117,223,179,.28)";
      connectionNotice.style.color = "#c9f7e1";
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;

    if (!supabaseClient) {
      toast(
        "Accounts are not connected yet. Add your Supabase URL and anon key to config.js.",
      );
      return;
    }

    try {
      if (state.mode === "signup") {
        const redirectTo =
          location.protocol === "file:"
            ? undefined
            : location.origin + location.pathname;
        const options = redirectTo ? { emailRedirectTo: redirectTo } : {};
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options,
        });
        if (error) throw error;
        if (data.session) await enterAuthenticatedApp(data.session);
        else toast("Account created. Check your email to verify your address.");
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await enterAuthenticatedApp(data.session);
      }
    } catch (error) {
      toast(error.message || "Unable to complete that account action.");
    }
  }

  async function forgotPassword() {
    const email = document.getElementById("emailInput").value.trim();
    if (!email) return toast("Enter your email first.");
    if (!supabaseClient) return toast("Connect Supabase in config.js first.");
    try {
      const redirectTo =
        location.protocol === "file:"
          ? undefined
          : location.origin + location.pathname;
      const options = redirectTo ? { redirectTo } : {};
      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        email,
        options,
      );
      if (error) throw error;
      toast("Password reset email sent.");
    } catch (error) {
      toast(error.message);
    }
  }

  function enterPreview() {
    state.preview = true;
    state.user = { id: "local-preview", email: "Local preview" };
    state.profile.preferred_name =
      localStorage.getItem("glam_preview_name") || "Glam";
    showApp();
    navigate("dashboard");
  }

  async function enterAuthenticatedApp(session) {
    state.preview = false;
    state.session = session;
    state.user = session.user;
    await loadProfile();
    await loadRole();
    showApp();
    navigate("dashboard");
  }

  async function loadProfile() {
    if (!supabaseClient || !state.user) return;
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", state.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) state.profile = Object.assign(state.profile, data);
    } catch (_error) {
      /* first login may precede profile row */
    }
  }

  async function loadRole() {
    state.isAdmin = false;
    if (!supabaseClient || !state.user) return;
    try {
      const { data } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", state.user.id)
        .eq("role", "admin")
        .maybeSingle();
      state.isAdmin = Boolean(data);
    } catch (_error) {}
  }

  function showAuth() {
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
  }

  function showApp() {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.getElementById("topbarEmail").textContent =
      state.user?.email || "Local preview";
    document.getElementById("accountInitial").textContent = (
      state.profile.preferred_name || "G"
    )
      .charAt(0)
      .toUpperCase();
    document
      .getElementById("adminNavBtn")
      .classList.toggle("hidden", !state.isAdmin);
  }

  async function logout() {
    if (state.preview) {
      state.preview = false;
      state.user = null;
      state.session = null;
      showAuth();
      return;
    }
    if (supabaseClient) await supabaseClient.auth.signOut();
    state.user = null;
    state.session = null;
    showAuth();
  }

  function navigate(page) {
    if (page === "admin" && !state.isAdmin) return;
    state.currentPage = page;
    document
      .querySelectorAll(".nav-item[data-page]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.page === page),
      );
    closeMenu();
    renderPage();
  }

  function renderPage() {
    if (state.currentPage === "dashboard") return renderDashboard();
    if (state.currentPage === "daily") return renderDailyGlam();
    if (state.currentPage === "settings") return renderSettings();
    if (state.currentPage === "admin") return renderAdmin();
    if (state.currentPage === "prompts")
      return renderCollection("prompts", "Saved Prompts", "prompt");

    if (state.currentPage === "projects")
      return renderCollection("projects", "Generator Projects", "project");

    if (state.currentPage === "ideas") return renderIdeaBrain();

    if (state.currentPage === "studio") return renderPromptStudio();
    if (state.currentPage === "vault") return renderGeneratorVault();

    if (pageMeta[state.currentPage]) return renderGeneric(state.currentPage);
  }

  function renderDashboard() {
    const name = escapeHtml(state.profile.preferred_name || "Creator");
    const promptCount = state.local.prompts.length;
    const projectCount = state.local.projects.length;
    const requestCount = state.local.usage.length;
    pageContainer.innerHTML = `
      <section class="hero">
        <p>WELCOME BACK</p>
        <h1>Good morning, ${name}.</h1>
        <span>What are we creating today?</span>
        <div class="quick-actions">
          <button data-go="projects">New Generator Project</button>
          <button data-go="ideas">Open Idea Brain</button>
          <button data-go="studio">Prompt Studio</button>
        </div>
      </section>
      <div class="content-grid">
        <section class="card">
          <div class="card-head"><h3>Recent Projects</h3><span class="badge">Private</span></div>
          ${projectCount ? listPreview(state.local.projects, 3) : empty("No projects yet. Your newest generator projects will appear here.")}
        </section>
        <section class="card">
          <div class="card-head"><h3>Daily Glam</h3><span class="badge">Personalized</span></div>
          <p class="daily-message">You don’t need the whole plan today. You need the next clear move.</p>
          ${ttsMarkup("You don’t need the whole plan today. You need the next clear move.")}
        </section>
        <section class="card"><div class="card-head"><h3>Saved Items</h3></div><div class="metric">${promptCount}<small>saved prompts</small></div></section>
        <section class="card"><div class="card-head"><h3>AI Usage</h3></div><div class="metric">${requestCount}<small>tracked requests</small></div><div class="usage-bar"><span style="width:${Math.min(requestCount, 100)}%"></span></div></section>
      </div>`;
    pageContainer.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const destination = btn.dataset.go;

        if (destination === "projects") {
          openItemModal("projects", "project");
          return;
        }

        navigate(destination);
      });
    });

    bindTTS();
  }

  function renderGeneric(key) {
    const [title, desc] = pageMeta[key];
    pageContainer.innerHTML =
      pageHeader(title, desc) +
      `
      <section class="card">
        <div class="card-head"><h3>${title}</h3><span class="badge">Private workspace</span></div>
        ${empty(`Nothing saved in ${title} yet.`)}
      </section>`;
  }

  function renderCollection(key, title, singular) {
    const items = state.local[key] || [];
    pageContainer.innerHTML =
      pageHeader(
        title,
        `Everything saved here belongs to the signed-in account.`,
      ) +
      `
      <section class="card">
        <div class="card-head"><h3>${title}</h3><button id="addItemBtn" class="btn btn-primary" type="button">Add ${capitalize(singular)}</button></div>
        <div id="collectionList">${items.length ? fullList(items, key) : empty(`No ${title.toLowerCase()} yet.`)}</div>
      </section>`;
    document
      .getElementById("addItemBtn")
      .addEventListener("click", () => openItemModal(key, singular));
    pageContainer
      .querySelectorAll("[data-delete]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          deleteLocalItem(key, btn.dataset.delete),
        ),
      );
  }

  function openItemModal(key, singular) {
    openModal(`
      <div class="section-kicker">NEW ${escapeHtml(singular)}</div>
      <h2>Add ${escapeHtml(capitalize(singular))}</h2>
      <form id="itemForm">
        <label>Title<input id="itemTitle" required maxlength="120" placeholder="Give this ${escapeHtml(singular)} a name"></label>
        <label>Notes<textarea id="itemBody" placeholder="Add your notes, prompt, idea, or project details..."></textarea></label>
        <button class="btn btn-primary btn-full" type="submit">Save</button>
      </form>`);
    document.getElementById("itemForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const item = {
        id: cryptoId(),
        title: document.getElementById("itemTitle").value.trim(),
        body: document.getElementById("itemBody").value.trim(),
        created_at: new Date().toISOString(),
      };
      state.local[key].unshift(item);
      saveLocalData();
      closeModal();
      renderCollection(key, pageTitleForCollection(key), singular);
      toast(`${capitalize(singular)} saved locally for preview.`);
    });
  }

  function deleteLocalItem(key, id) {
    state.local[key] = state.local[key].filter((item) => item.id !== id);
    saveLocalData();
    renderPage();
  }

  function renderIdeaBrain() {
    const messages = state.local.ideas || [];

    pageContainer.innerHTML = `
    ${pageHeader(
      "Idea Brain",
      "Brainstorm, organize, and develop your ideas in your private workspace.",
    )}

    <section class="card idea-brain-card">
      <div class="card-head">
        <div>
          <h3>Idea Brain Conversation</h3>
          <span class="badge">Private</span>
        </div>

        <button id="clearIdeaBrainBtn" class="btn btn-secondary" type="button">
          Clear Conversation
        </button>
      </div>

      <div id="ideaBrainMessages" class="idea-brain-messages">
        ${
          messages.length
            ? messages
                .map(
                  (message) => `
                <div class="idea-message ${message.role === "assistant" ? "idea-assistant" : "idea-user"}">
                  <div class="idea-message-label">
                    ${message.role === "assistant" ? "IDEA BRAIN" : escapeHtml(state.profile.preferred_name || "YOU")}
                  </div>

                  <div class="idea-message-bubble">
                    ${escapeHtml(message.body)}
                  </div>
                </div>
              `,
                )
                .join("")
            : `
              <div class="idea-brain-empty">
                <span class="badge">Start Here</span>
                <h3>What are you thinking about?</h3>
                <p>
                  Drop an idea, product concept, generator idea, business thought,
                  content concept, or something you want help developing.
                </p>
              </div>
            `
        }
      </div>

      <form id="ideaBrainForm" class="idea-brain-form">
        <label>
          Your idea
          <textarea
            id="ideaBrainInput"
            placeholder="Example: I want to create a generator that helps beginners make premium holiday digital products..."
            required
          ></textarea>
        </label>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit">
            Ask Idea Brain
          </button>

          <button id="saveIdeaBtn" class="btn btn-secondary" type="button">
            Save Idea
          </button>
        </div>

        <small class="idea-brain-note">
          Local brainstorm mode is active. We’ll connect the secure AI backend later.
        </small>
      </form>
    </section>
  `;

    const form = document.getElementById("ideaBrainForm");
    const input = document.getElementById("ideaBrainInput");

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const text = input.value.trim();
      if (!text) return;

      state.local.ideas.push({
        id: cryptoId(),
        role: "user",
        body: text,
        created_at: new Date().toISOString(),
      });

      state.local.ideas.push({
        id: cryptoId(),
        role: "assistant",
        body: createLocalIdeaBrainReply(text),
        created_at: new Date().toISOString(),
      });

      saveLocalData();
      renderIdeaBrain();

      requestAnimationFrame(() => {
        const messageArea = document.getElementById("ideaBrainMessages");

        if (messageArea) {
          messageArea.scrollTop = messageArea.scrollHeight;
        }
      });
    });

    document.getElementById("saveIdeaBtn").addEventListener("click", () => {
      const text = input.value.trim();

      if (!text) {
        toast("Type an idea first.");
        return;
      }

      state.local.ideas.push({
        id: cryptoId(),
        role: "user",
        body: text,
        created_at: new Date().toISOString(),
      });

      saveLocalData();
      toast("Idea saved in your private preview workspace.");
      renderIdeaBrain();
    });

    document
      .getElementById("clearIdeaBrainBtn")
      .addEventListener("click", () => {
        state.local.ideas = [];
        saveLocalData();
        renderIdeaBrain();
        toast("Idea Brain conversation cleared.");
      });
  }

  function createLocalIdeaBrainReply(idea) {
    const cleanIdea = String(idea || "").trim();

    return `I see the direction. Let’s build this out around "${cleanIdea}".

Start with the main purpose: what should this help the user create or accomplish?

From there, we can define the generator inputs, output types, presets, customization options, and what should make it different from a basic generator.`;
  }

  function renderPromptStudio() {
    pageContainer.innerHTML = `
    ${pageHeader(
      "Universal Prompt Studio",
      "Build, preview, copy, and save polished prompts in your private workspace.",
    )}

    <div class="content-grid prompt-studio-grid">

      <section class="card">
        <div class="card-head">
          <div>
            <h3>Build Your Prompt</h3>
            <span class="badge">Private</span>
          </div>
        </div>

        <form id="promptStudioForm">

          <label>
            Prompt Title
            <input
              id="promptTitle"
              type="text"
              maxlength="120"
              placeholder="Example: Luxury Product Mockup Prompt"
            >
          </label>

          <label>
            Goal
            <textarea
              id="promptGoal"
              placeholder="What do you want the AI to create or accomplish?"
              required
            ></textarea>
          </label>

          <label>
            Audience
            <input
              id="promptAudience"
              type="text"
              placeholder="Example: Women 40+ building digital-product businesses"
            >
          </label>

          <label>
            Style / Creative Direction
            <textarea
              id="promptStyle"
              placeholder="Example: Bright luxury editorial, Caribbean sapphire blue, metallic silver, clean polished composition..."
            ></textarea>
          </label>

          <label>
            Subject / Main Focus
            <input
              id="promptSubject"
              type="text"
              placeholder="What is the main subject?"
            >
          </label>

          <label>
            Must Include
            <textarea
              id="promptInclude"
              placeholder="List important details, features, wording, colors, objects, or instructions that must be included."
            ></textarea>
          </label>

          <label>
            Avoid
            <textarea
              id="promptAvoid"
              placeholder="List anything the AI should not add, change, remove, or generate."
            ></textarea>
          </label>

          <label>
            Output Format
            <select id="promptFormat">
              <option value="General Prompt">General Prompt</option>
              <option value="Image Prompt">Image Prompt</option>
              <option value="Video Prompt">Video Prompt</option>
              <option value="Social Media Prompt">Social Media Prompt</option>
              <option value="Product Description Prompt">Product Description Prompt</option>
              <option value="UGC Prompt">UGC Prompt</option>
              <option value="Website Prompt">Website Prompt</option>
              <option value="Custom Instructions">Custom Instructions</option>
            </select>
          </label>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit">
              Build Prompt
            </button>

            <button id="clearPromptStudioBtn" class="btn btn-secondary" type="button">
              Clear
            </button>
          </div>

        </form>
      </section>


      <section class="card prompt-preview-card">
        <div class="card-head">
          <div>
            <h3>Prompt Preview</h3>
            <span class="badge">Ready to Copy</span>
          </div>
        </div>

        <div id="promptPreview" class="prompt-preview">
          <div class="empty-state">
            Fill out the builder and click <strong>Build Prompt</strong>.
            Your finished prompt will appear here.
          </div>
        </div>

        <div class="form-actions">
          <button id="copyPromptBtn" class="btn btn-secondary" type="button" disabled>
            Copy Prompt
          </button>

          <button id="savePromptBtn" class="btn btn-primary" type="button" disabled>
            Save Prompt
          </button>
        </div>
      </section>

    </div>
  `;

    const form = document.getElementById("promptStudioForm");
    const preview = document.getElementById("promptPreview");
    const copyBtn = document.getElementById("copyPromptBtn");
    const saveBtn = document.getElementById("savePromptBtn");

    let generatedPrompt = "";

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      generatedPrompt = buildStudioPrompt();

      preview.innerHTML = `
      <div class="generated-prompt">
        ${escapeHtml(generatedPrompt).replace(/\n/g, "<br>")}
      </div>
    `;

      copyBtn.disabled = false;
      saveBtn.disabled = false;
    });

    copyBtn.addEventListener("click", async () => {
      if (!generatedPrompt) return;

      try {
        await navigator.clipboard.writeText(generatedPrompt);
        toast("Prompt copied.");
      } catch (_error) {
        fallbackCopyText(generatedPrompt);
        toast("Prompt copied.");
      }
    });

    saveBtn.addEventListener("click", () => {
      if (!generatedPrompt) return;

      const title =
        document.getElementById("promptTitle").value.trim() ||
        "Untitled Prompt";

      state.local.prompts.unshift({
        id: cryptoId(),
        title,
        body: generatedPrompt,
        created_at: new Date().toISOString(),
      });

      saveLocalData();
      toast("Prompt saved to Saved Prompts.");
    });

    document
      .getElementById("clearPromptStudioBtn")
      .addEventListener("click", () => {
        form.reset();
        generatedPrompt = "";

        preview.innerHTML = `
      <div class="empty-state">
        Fill out the builder and click <strong>Build Prompt</strong>.
        Your finished prompt will appear here.
      </div>
    `;

        copyBtn.disabled = true;
        saveBtn.disabled = true;
      });
  }

  function buildStudioPrompt() {
    const title = document.getElementById("promptTitle").value.trim();
    const goal = document.getElementById("promptGoal").value.trim();
    const audience = document.getElementById("promptAudience").value.trim();
    const style = document.getElementById("promptStyle").value.trim();
    const subject = document.getElementById("promptSubject").value.trim();
    const include = document.getElementById("promptInclude").value.trim();
    const avoid = document.getElementById("promptAvoid").value.trim();
    const format = document.getElementById("promptFormat").value;

    const parts = [];

    if (title) {
      parts.push(`PROMPT TITLE:\n${title}`);
    }

    parts.push(`OUTPUT TYPE:\n${format}`);

    if (goal) {
      parts.push(`GOAL:\n${goal}`);
    }

    if (audience) {
      parts.push(`AUDIENCE:\n${audience}`);
    }

    if (subject) {
      parts.push(`MAIN SUBJECT:\n${subject}`);
    }

    if (style) {
      parts.push(`STYLE / CREATIVE DIRECTION:\n${style}`);
    }

    if (include) {
      parts.push(`MUST INCLUDE:\n${include}`);
    }

    if (avoid) {
      parts.push(`AVOID:\n${avoid}`);
    }

    parts.push(
      `FINAL INSTRUCTIONS:
Create a polished, complete result that follows every requirement above.
Keep all important wording correctly spelled, fully visible, unobstructed, and easy to read.
Do not invent unrelated details or remove requested elements.
Maintain a clean, intentional, professional composition and strong visual hierarchy.`,
    );

    return parts.join("\n\n");
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    document.execCommand("copy");

    textarea.remove();
  }

  function renderGeneratorVault() {
    const generators = state.local.generators || [];

    pageContainer.innerHTML = `
    ${pageHeader(
      "Generator Vault",
      "Create, organize, favorite, and manage your private generator collection.",
    )}

    <section class="card">
      <div class="card-head">
        <div>
          <h3>Your Generators</h3>
          <span class="badge" id="vaultSavedCount">${generators.length} Saved</span>
        </div>

        <div class="form-actions vault-actions">
          <input
            id="generatorFolderInput"
            type="file"
            webkitdirectory
            directory
            multiple
            hidden
          >

          <button
            id="uploadGeneratorFolderBtn"
            class="btn btn-secondary"
            type="button"
          >
            Upload Generator Folder
          </button>

          <button
            id="addGeneratorBtn"
            class="btn btn-primary"
            type="button"
          >
            Add Generator
          </button>
        </div>
      </div>

      <div
        class="vault-search-toolbar"
        style="
          display:grid;
          grid-template-columns:minmax(220px,1fr) minmax(180px,240px);
          gap:12px;
          margin:18px 0 22px;
          align-items:end;
        "
      >
        <label style="margin:0;">
          Search Generators
          <input
            id="vaultSearchInput"
            type="search"
            placeholder="Search by generator name..."
            autocomplete="off"
          >
        </label>

        <label style="margin:0;">
          Filter
          <select id="vaultFilterSelect">
            <option value="all">All</option>
            <option value="folders">Uploaded Folders</option>
            <option value="favorites">Favorites</option>
            <option value="testing">Testing</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      <div
        id="vaultNoMatches"
        class="empty-state hidden"
        style="margin-bottom:18px;"
      >
        No generators match your search or filter.
      </div>

      ${
        generators.length
          ? `
            <div class="generator-vault-grid" id="generatorVaultGrid">
              ${generators
                .map(
                  (generator) => `
                <article
                  class="generator-vault-card"
                  data-vault-card
                  data-title="${escapeAttr((generator.title || "").toLowerCase())}"
                  data-source="${escapeAttr(generator.sourceType || "")}"
                  data-favorite="${generator.favorite ? "true" : "false"}"
                  data-status="${escapeAttr((generator.status || "Draft").toLowerCase())}"
                >
                  <div class="generator-vault-top">
                    <span class="badge">${escapeHtml(generator.category || "General")}</span>

                    <button
                      class="generator-favorite ${generator.favorite ? "active" : ""}"
                      type="button"
                      data-favorite-generator="${generator.id}"
                      aria-label="Favorite generator"
                    >
                      ${generator.favorite ? "★" : "☆"}
                    </button>
                  </div>

                  <h3>${escapeHtml(generator.title)}</h3>

                  <p>
                    ${escapeHtml(generator.description || "No description added yet.")}
                  </p>

                  ${
                    generator.sourceType === "folder"
                      ? `
                        <div class="generator-meta">
                          <span>Uploaded Folder</span>
                          <small>${Number(generator.fileCount || 0)} files${generator.hasIndex ? " • index.html found" : ""}</small>
                        </div>
                      `
                      : ""
                  }

                  <div class="generator-meta">
                    <span>${escapeHtml(generator.status || "Draft")}</span>
                    <small>${formatDate(generator.created_at)}</small>
                  </div>

                  <div class="form-actions">
                    <button
                      class="btn btn-secondary"
                      type="button"
                      data-open-generator="${generator.id}"
                    >
                      Open
                    </button>

                    <button
                      class="btn btn-secondary"
                      type="button"
                      data-edit-generator="${generator.id}"
                    >
                      Edit
                    </button>

                    <button
                      class="link-btn"
                      type="button"
                      data-delete-generator="${generator.id}"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              `,
                )
                .join("")}
            </div>
          `
          : `
            <div class="empty-state">
              No generators in your vault yet. Click <strong>Add Generator</strong> or <strong>Upload Generator Folder</strong> to add your first one.
            </div>
          `
      }
    </section>
  `;

    document
      .getElementById("addGeneratorBtn")
      .addEventListener("click", () => openGeneratorModal());

    const folderInput = document.getElementById("generatorFolderInput");
    const uploadFolderBtn = document.getElementById("uploadGeneratorFolderBtn");
    const searchInput = document.getElementById("vaultSearchInput");
    const filterSelect = document.getElementById("vaultFilterSelect");
    const noMatches = document.getElementById("vaultNoMatches");
    const savedCount = document.getElementById("vaultSavedCount");

    function applyVaultFilters() {
      const query = (searchInput?.value || "").trim().toLowerCase();
      const filter = filterSelect?.value || "all";
      const cards = Array.from(
        pageContainer.querySelectorAll("[data-vault-card]"),
      );

      let visibleCount = 0;

      cards.forEach((card) => {
        const title = card.dataset.title || "";
        const source = card.dataset.source || "";
        const favorite = card.dataset.favorite === "true";
        const status = card.dataset.status || "";

        const matchesSearch = !query || title.includes(query);

        let matchesFilter = true;

        if (filter === "folders") {
          matchesFilter = source === "folder";
        } else if (filter === "favorites") {
          matchesFilter = favorite;
        } else if (
          ["testing", "active", "draft", "archived"].includes(filter)
        ) {
          matchesFilter = status === filter;
        }

        const visible = matchesSearch && matchesFilter;

        card.classList.toggle("hidden", !visible);

        if (visible) visibleCount += 1;
      });

      if (savedCount) {
        savedCount.textContent =
          query || filter !== "all"
            ? `${visibleCount} of ${generators.length}`
            : `${generators.length} Saved`;
      }

      if (noMatches) {
        noMatches.classList.toggle(
          "hidden",
          generators.length === 0 || visibleCount > 0,
        );
      }
    }

    searchInput?.addEventListener("input", applyVaultFilters);
    filterSelect?.addEventListener("change", applyVaultFilters);

    uploadFolderBtn.addEventListener("click", () => {
      folderInput.click();
    });

    folderInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);

      if (!files.length) return;

      const firstPath = files[0].webkitRelativePath || files[0].name;
      const folderName = firstPath.split("/")[0];

      const indexFile = files.find((file) => {
        const path = (file.webkitRelativePath || file.name).toLowerCase();

        return path.endsWith("/index.html") || path === "index.html";
      });

      const folderSignature = files
        .map((file) => {
          const path = (file.webkitRelativePath || file.name).toLowerCase();
          return `${path}|${file.size}`;
        })
        .sort()
        .join("||");

      let duplicateFolder = (state.local.generators || []).find(
        (item) =>
          item.sourceType === "folder" &&
          item.folderSignature === folderSignature,
      );

      // Backward-compatible duplicate check for folders uploaded before
      // folderSignature was added to Generator Vault records.
      if (!duplicateFolder) {
        const storedFolderGenerators = (state.local.generators || []).filter(
          (item) => item.sourceType === "folder" && item.folderId,
        );

        for (const existingGenerator of storedFolderGenerators) {
          try {
            const existingFolder = await getGeneratorFolderFromDatabase(
              existingGenerator.folderId,
            );

            if (!existingFolder || !Array.isArray(existingFolder.files)) continue;

            const existingSignature = existingFolder.files
              .map((entry) => {
                const path = String(entry.path || entry.name || "").toLowerCase();
                const size =
                  typeof entry.size === "number"
                    ? entry.size
                    : entry.file?.size || 0;

                return `${path}|${size}`;
              })
              .sort()
              .join("||");

            if (existingSignature === folderSignature) {
              duplicateFolder = existingGenerator;

              // Upgrade the older vault record so future checks are instant.
              existingGenerator.folderSignature = folderSignature;
              saveLocalData();
              break;
            }
          } catch (error) {
            console.error("Unable to check existing folder signature:", error);
          }
        }
      }

      if (duplicateFolder) {
        toast(`"${folderName}" is already in your vault.`);
        event.target.value = "";
        return;
      }

      const folderId = cryptoId();

      const folderRecord = {
        id: folderId,
        name: folderName,
        signature: folderSignature,
        fileCount: files.length,
        hasIndex: Boolean(indexFile),
        created_at: new Date().toISOString(),
        files: files.map((file) => ({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          file,
        })),
      };

      try {
        toast(`Saving ${folderName}...`);

        await saveGeneratorFolderToDatabase(folderRecord);

        state.local.generators.unshift({
          id: cryptoId(),
          title: folderName,
          category: "Uploaded Folder",
          description: `${files.length} files stored in your Generator Hub.`,
          link: "",
          file: indexFile ? indexFile.webkitRelativePath || "index.html" : "",
          folderId,
          folderSignature,
          fileCount: files.length,
          hasIndex: Boolean(indexFile),
          sourceType: "folder",
          status: "Testing",
          favorite: false,
          created_at: new Date().toISOString(),
        });

        saveLocalData();

        toast(
          `${folderName} uploaded — ${files.length} files${
            indexFile ? " — index.html found" : ""
          }.`,
        );

        renderGeneratorVault();
      } catch (error) {
        console.error("Folder upload failed:", error);

        toast(
          "The folder could not be saved. The browser may not have enough storage space.",
        );
      }

      event.target.value = "";
    });

    pageContainer
      .querySelectorAll("[data-favorite-generator]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          toggleGeneratorFavorite(button.dataset.favoriteGenerator);
        });
      });

    pageContainer
      .querySelectorAll("[data-delete-generator]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          deleteGenerator(button.dataset.deleteGenerator);
        });
      });

    pageContainer
      .querySelectorAll("[data-edit-generator]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const generator = generators.find(
            (item) => item.id === button.dataset.editGenerator,
          );

          if (generator) openGeneratorModal(generator);
        });
      });

    pageContainer
      .querySelectorAll("[data-open-generator]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          openGeneratorDetails(button.dataset.openGenerator);
        });
      });

    applyVaultFilters();
  }

  function openGeneratorModal(generator = null) {
    const editing = Boolean(generator);

    openModal(`
    <div class="section-kicker">
      ${editing ? "EDIT GENERATOR" : "NEW GENERATOR"}
    </div>

    <h2>${editing ? "Edit Generator" : "Add Generator"}</h2>

    <form id="generatorForm">

      <label>
        Generator Name
        <input
          id="generatorTitle"
          type="text"
          maxlength="120"
          required
          value="${escapeAttr(generator?.title || "")}"
          placeholder="Example: Halloween Prompt Generator"
        >
      </label>

      <label>
        Category
        <select id="generatorCategory">
          <option value="General">General</option>
          <option value="Image Generator">Image Generator</option>
          <option value="Prompt Generator">Prompt Generator</option>
          <option value="Video Generator">Video Generator</option>
          <option value="UGC Generator">UGC Generator</option>
          <option value="Mockup Generator">Mockup Generator</option>
          <option value="Stationery Generator">Stationery Generator</option>
          <option value="Business Generator">Business Generator</option>
          <option value="Content Generator">Content Generator</option>
        </select>
      </label>

      <label>
        Description
        <textarea
          id="generatorDescription"
          placeholder="What does this generator create?"
        >${escapeHtml(generator?.description || "")}</textarea>
      </label>

      <label>
  Generator Link
  <input
    id="generatorLink"
    type="url"
    value="${escapeAttr(generator?.link || "")}"
    placeholder="https://your-generator-link.com"
  >
</label>

<label>
  File Name / Local Reference
  <input
    id="generatorFile"
    type="text"
    value="${escapeAttr(generator?.file || "")}"
    placeholder="Example: halloween-generator.html or C:\\My Generators\\generator.html"
  >
</label>

      <label>
        Status
        <select id="generatorStatus">
          <option value="Draft">Draft</option>
          <option value="Active">Active</option>
          <option value="Testing">Testing</option>
          <option value="Archived">Archived</option>
        </select>
      </label>

      <button class="btn btn-primary btn-full" type="submit">
        ${editing ? "Save Changes" : "Save Generator"}
      </button>

    </form>
  `);

    if (generator) {
      document.getElementById("generatorCategory").value =
        generator.category || "General";

      document.getElementById("generatorStatus").value =
        generator.status || "Draft";
    }

    document
      .getElementById("generatorForm")
      .addEventListener("submit", (event) => {
        event.preventDefault();

        const title = document.getElementById("generatorTitle").value.trim();

        const category = document.getElementById("generatorCategory").value;

        const description = document
          .getElementById("generatorDescription")
          .value.trim();

        const link = document.getElementById("generatorLink").value.trim();

        const file = document.getElementById("generatorFile").value.trim();

        const status = document.getElementById("generatorStatus").value;

        if (editing) {
          generator.title = title;
          generator.link = link;
          generator.file = file;
          generator.category = category;
          generator.description = description;
          generator.status = status;
          generator.updated_at = new Date().toISOString();

          toast("Generator updated.");
        } else {
          state.local.generators.unshift({
            id: cryptoId(),
            title,
            category,
            description,
            link,
            file,
            status,
            favorite: false,
            created_at: new Date().toISOString(),
          });

          toast("Generator added to your vault.");
        }

        saveLocalData();
        closeModal();
        renderGeneratorVault();
      });
  }

  function toggleGeneratorFavorite(id) {
    const generator = (state.local.generators || []).find(
      (item) => item.id === id,
    );

    if (!generator) return;

    generator.favorite = !generator.favorite;

    saveLocalData();
    renderGeneratorVault();

    toast(
      generator.favorite
        ? "Added to Favorite Styles."
        : "Removed from favorites.",
    );
  }

  async function deleteGenerator(id) {
    const generator = (state.local.generators || []).find(
      (item) => item.id === id,
    );

    if (generator?.folderId) {
      try {
        await deleteGeneratorFolderFromDatabase(generator.folderId);
      } catch (error) {
        console.error("Unable to remove stored generator folder:", error);
      }
    }

    state.local.generators = (state.local.generators || []).filter(
      (item) => item.id !== id,
    );

    saveLocalData();
    renderGeneratorVault();
    toast("Generator deleted.");
  }

  async function openGeneratorDetails(id) {
    const generator = (state.local.generators || []).find(
      (item) => item.id === id,
    );

    if (!generator) return;

    if (generator.folderId) {
      try {
        toast(`Opening ${generator.title}...`);

        const folderRecord = await getGeneratorFolderFromDatabase(
          generator.folderId,
        );

        if (!folderRecord) {
          toast("The stored generator folder could not be found.");
          return;
        }

        await openStoredGeneratorPreview(folderRecord, generator);
      } catch (error) {
        console.error("Unable to open stored generator:", error);
        toast("The uploaded generator could not be opened.");
      }

      return;
    }

    if (generator.link) {
      window.open(generator.link, "_blank", "noopener,noreferrer");
      return;
    }

    openModal(`
    <div class="section-kicker">GENERATOR VAULT</div>

    <h2>${escapeHtml(generator.title)}</h2>

    <div class="stack">
      <span class="badge">${escapeHtml(generator.category)}</span>

      <p style="color:var(--text-soft);line-height:1.7;">
        ${escapeHtml(generator.description || "No description added yet.")}
      </p>

      ${
        generator.file
          ? `
            <div class="item-row">
              <div>
                <strong>File Reference</strong>
                <small>${escapeHtml(generator.file)}</small>
              </div>
            </div>
          `
          : ""
      }

      <div class="item-row">
        <div>
          <strong>Status</strong>
          <small>${escapeHtml(generator.status)}</small>
        </div>
      </div>
    </div>
  `);
  }

  async function openStoredGeneratorPreview(folderRecord, generator) {
    const storedFiles = Array.isArray(folderRecord.files)
      ? folderRecord.files
      : [];

    if (!storedFiles.length) {
      toast("This uploaded folder does not contain any stored files.");
      return;
    }

    const rootName = folderRecord.name || "";
    const fileMap = new Map();

    storedFiles.forEach((entry) => {
      const originalPath = String(entry.path || entry.name || "").replace(
        /\\/g,
        "/",
      );

      let relativePath = originalPath;

      if (rootName && relativePath.startsWith(`${rootName}/`)) {
        relativePath = relativePath.slice(rootName.length + 1);
      }

      relativePath = normalizeGeneratorPath(relativePath);

      fileMap.set(relativePath, entry);
    });

    const indexEntry =
      fileMap.get("index.html") ||
      Array.from(fileMap.entries()).find(([path]) =>
        path.toLowerCase().endsWith("/index.html"),
      )?.[1];

    if (!indexEntry?.file) {
      toast("No index.html file was found in this uploaded folder.");
      return;
    }

    const createdUrls = [];
    const resourceUrls = new Map();

    const createUrl = (blob) => {
      const url = URL.createObjectURL(blob);
      createdUrls.push(url);
      return url;
    };

    // First create URLs for binary/static assets.
    for (const [path, entry] of fileMap.entries()) {
      if (!entry?.file) continue;

      const extension = getGeneratorExtension(path);

      if (!["html", "htm", "css", "js", "mjs"].includes(extension)) {
        resourceUrls.set(path, createUrl(entry.file));
      }
    }

    // Build rewritten CSS files so url(...) assets continue to work.
    for (const [path, entry] of fileMap.entries()) {
      if (!entry?.file || getGeneratorExtension(path) !== "css") continue;

      let cssText = await entry.file.text();

      cssText = rewriteGeneratorCssUrls(
        cssText,
        path,
        resourceUrls,
        fileMap,
        createUrl,
      );

      const cssBlob = new Blob([cssText], {
        type: "text/css;charset=utf-8",
      });

      resourceUrls.set(path, createUrl(cssBlob));
    }

    // Classic JavaScript files work from blob URLs. Most generator folders
    // use normal script.js files rather than module imports.
    for (const [path, entry] of fileMap.entries()) {
      if (!entry?.file) continue;

      const extension = getGeneratorExtension(path);

      if (extension === "js" || extension === "mjs") {
        let jsText = await entry.file.text();

        jsText = rewriteAiCoachBridgeCalls(jsText);

        const jsBlob = new Blob([jsText], {
          type: "text/javascript;charset=utf-8",
        });

        resourceUrls.set(path, createUrl(jsBlob));
      }
    }

    let htmlText = await indexEntry.file.text();

    htmlText = rewriteAiCoachBridgeCalls(htmlText);

    htmlText = rewriteGeneratorHtmlUrls(htmlText, "index.html", resourceUrls);

    // Add a tiny banner only when something could not be resolved.
    // The generator itself remains unchanged otherwise.
    const htmlBlob = new Blob([htmlText], {
      type: "text/html;charset=utf-8",
    });

    const previewUrl = createUrl(htmlBlob);
    const previewWindow = window.open(
      previewUrl,
      "_blank",
      "noopener,noreferrer",
    );

    if (!previewWindow) {
      toast("Edge blocked the preview window. Allow pop-ups for this page.");
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
      return;
    }

    toast(`${generator.title} opened from your Generator Vault.`);

    // Keep blob URLs alive long enough for the opened generator to load.
    setTimeout(
      () => {
        createdUrls.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (_error) {}
        });
      },
      10 * 60 * 1000,
    );
  }

  function rewriteAiCoachBridgeCalls(sourceText) {
    const bridgeUrl = String(config.AI_COACH_BRIDGE_URL || "")
      .trim()
      .replace(/\/+$/, "");

    if (!bridgeUrl) {
      return String(sourceText || "");
    }

    return String(sourceText || "").replace(
      /(["'`])\/\.netlify\/functions\/coach\1/g,
      (match, quote) => `${quote}${bridgeUrl}${quote}`,
    );
  }

  function rewriteGeneratorHtmlUrls(html, htmlPath, resourceUrls) {
    return String(html || "").replace(
      /\b(src|href)=["']([^"'#][^"']*)["']/gi,
      (match, attribute, value) => {
        if (
          /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|\/\/)/i.test(value)
        ) {
          return match;
        }

        const cleanValue = value.split("?")[0].split("#")[0];
        const resolvedPath = resolveGeneratorRelativePath(htmlPath, cleanValue);

        const replacement = resourceUrls.get(resolvedPath);

        if (!replacement) return match;

        return `${attribute}="${replacement}"`;
      },
    );
  }

  function rewriteGeneratorCssUrls(
    css,
    cssPath,
    resourceUrls,
    fileMap,
    createUrl,
  ) {
    return String(css || "").replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (match, quote, value) => {
        const trimmed = value.trim();

        if (/^(?:https?:|data:|blob:|\/\/|#)/i.test(trimmed)) {
          return match;
        }

        const cleanValue = trimmed.split("?")[0].split("#")[0];
        const resolvedPath = resolveGeneratorRelativePath(cssPath, cleanValue);

        let replacement = resourceUrls.get(resolvedPath);

        if (!replacement) {
          const entry = fileMap.get(resolvedPath);

          if (entry?.file) {
            replacement = createUrl(entry.file);
            resourceUrls.set(resolvedPath, replacement);
          }
        }

        if (!replacement) return match;

        return `url("${replacement}")`;
      },
    );
  }

  function resolveGeneratorRelativePath(fromPath, targetPath) {
    const target = String(targetPath || "").replace(/\\/g, "/");

    if (target.startsWith("/")) {
      return normalizeGeneratorPath(target.slice(1));
    }

    const baseParts = normalizeGeneratorPath(fromPath)
      .split("/")
      .filter(Boolean);

    baseParts.pop();

    const targetParts = target.split("/");

    for (const part of targetParts) {
      if (!part || part === ".") continue;

      if (part === "..") {
        baseParts.pop();
      } else {
        baseParts.push(part);
      }
    }

    return normalizeGeneratorPath(baseParts.join("/"));
  }

  function normalizeGeneratorPath(path) {
    const parts = String(path || "")
      .replace(/\\/g, "/")
      .split("/");

    const normalized = [];

    for (const part of parts) {
      if (!part || part === ".") continue;

      if (part === "..") {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    return normalized.join("/");
  }

  function getGeneratorExtension(path) {
    const cleanPath = String(path || "")
      .split("?")[0]
      .split("#")[0];
    const fileName = cleanPath.split("/").pop() || "";
    const dotIndex = fileName.lastIndexOf(".");

    return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
  }

  function renderDailyGlam() {
    const p = state.profile;
    const name = escapeHtml(p.preferred_name || "Creator");
    const verse = p.faith_based
      ? `<p class="verse">Commit your work to the Lord, and your plans will be established. — Proverbs 16:3</p>`
      : "";
    pageContainer.innerHTML =
      pageHeader(
        "Daily Glam",
        "Encouragement that matches each user’s preferences.",
      ) +
      `
      <div class="content-grid">
        <section class="card">
          <div class="card-head"><h3>Today</h3><span class="badge">For ${name}</span></div>
          <p class="daily-message">Good morning, ${name}. You’re allowed to build this one strong piece at a time.</p>
          ${verse}
          ${ttsMarkup(`Good morning, ${p.preferred_name || "Creator"}. You’re allowed to build this one strong piece at a time.`)}
        </section>
        <section class="card">
          <div class="card-head"><h3>Preferences</h3></div>
          <form id="dailyForm">
            <label>Preferred name<input id="preferredName" value="${escapeAttr(p.preferred_name || "")}" placeholder="What should we call you?"></label>
            ${toggle("daily_glam", "Daily Glam messages", p.daily_glam)}
            ${toggle("affirmations", "Affirmations", p.affirmations)}
            ${toggle("general_encouragement", "General encouragement", p.general_encouragement)}
            ${toggle("business_motivation", "Business motivation", p.business_motivation)}
            ${toggle("faith_based", "Bible verses / faith-based content", p.faith_based)}
            <div class="form-actions"><button class="btn btn-primary" type="submit">Save Preferences</button></div>
          </form>
        </section>
      </div>`;
    bindTTS();
    document
      .getElementById("dailyForm")
      .addEventListener("submit", saveDailyPreferences);
  }

  async function saveDailyPreferences(event) {
    event.preventDefault();
    const keys = [
      "daily_glam",
      "affirmations",
      "general_encouragement",
      "business_motivation",
      "faith_based",
    ];
    state.profile.preferred_name =
      document.getElementById("preferredName").value.trim() || "Creator";
    keys.forEach(
      (key) => (state.profile[key] = document.getElementById(key).checked),
    );
    localStorage.setItem("glam_preview_name", state.profile.preferred_name);

    if (supabaseClient && state.user && !state.preview) {
      const payload = Object.assign({}, state.profile, {
        id: state.user.id,
        email: state.user.email,
        updated_at: new Date().toISOString(),
      });
      const { error } = await supabaseClient.from("profiles").upsert(payload);
      if (error) return toast(error.message);
      toast("Preferences saved to your private account.");
    } else toast("Preferences saved in this browser for local preview.");

    document.getElementById("accountInitial").textContent =
      state.profile.preferred_name.charAt(0).toUpperCase();
    renderDailyGlam();
  }

  function renderSettings() {
    pageContainer.innerHTML =
      pageHeader(
        "Profile & Settings",
        "Manage your account, personalization, and security settings.",
      ) +
      `
      <div class="content-grid">
        <section class="card">
          <div class="card-head"><h3>Profile</h3><span class="badge">${state.preview ? "Local preview" : "Authenticated"}</span></div>
          <p><strong>${escapeHtml(state.profile.preferred_name || "Creator")}</strong></p>
          <p style="color:var(--muted)">${escapeHtml(state.user?.email || "")}</p>
          <div class="form-actions"><button id="changeEmailBtn" class="btn btn-secondary">Change Email</button><button id="changePasswordBtn" class="btn btn-secondary">Change Password</button></div>
        </section>
        <section class="card">
          <div class="card-head"><h3>Account</h3></div>
          <p style="color:var(--muted);line-height:1.55">Account deletion is intentionally handled by a privileged backend function so one browser cannot delete another user's authentication record.</p>
          <button id="deleteAccountBtn" class="btn btn-danger">Delete Account</button>
        </section>
      </div>`;
    document
      .getElementById("changeEmailBtn")
      .addEventListener("click", changeEmail);
    document
      .getElementById("changePasswordBtn")
      .addEventListener("click", changePassword);
    document
      .getElementById("deleteAccountBtn")
      .addEventListener("click", () =>
        toast(
          "Delete Account requires the secure backend delete-user function before it is enabled.",
        ),
      );
  }

  async function changeEmail() {
    if (state.preview)
      return toast("Connect and log into Supabase to change an account email.");
    const email = prompt("Enter your new email address:");
    if (!email) return;
    const { error } = await supabaseClient.auth.updateUser({ email });
    toast(
      error
        ? error.message
        : "Check your new email address to confirm the change.",
    );
  }

  async function changePassword() {
    if (state.preview)
      return toast(
        "Connect and log into Supabase to change an account password.",
      );
    const password = prompt("Enter your new password:");
    if (!password) return;
    const { error } = await supabaseClient.auth.updateUser({ password });
    toast(error ? error.message : "Password changed.");
  }

  function renderAdmin() {
    pageContainer.innerHTML =
      pageHeader(
        "Admin",
        "High-level platform information without exposing customers’ private prompt content.",
      ) +
      `
      <div class="content-grid">
        <section class="card"><div class="card-head"><h3>Total Registered Users</h3></div><div class="metric">—<small>Requires secure aggregate admin RPC/function</small></div></section>
        <section class="card"><div class="card-head"><h3>AI Usage</h3></div><div class="metric">—<small>Platform aggregate</small></div></section>
        <section class="card"><div class="card-head"><h3>Generators Created</h3></div><div class="metric">—<small>Platform aggregate</small></div></section>
        <section class="card"><div class="card-head"><h3>Failed Requests</h3></div><div class="metric">—<small>Platform aggregate</small></div></section>
      </div>
      <p class="admin-note">Admin metrics should be returned by a protected backend function or security-definer RPC that verifies the admin role. The browser should not be given blanket access to customer-owned rows.</p>`;
  }

  function bindTTS() {
    pageContainer.querySelectorAll("[data-tts]").forEach((group) => {
      const text = decodeURIComponent(group.dataset.tts);
      group
        .querySelector("[data-action='play']")
        ?.addEventListener("click", () => speak(text, group));
      group
        .querySelector("[data-action='pause']")
        ?.addEventListener("click", () => {
          speechSynthesis.pause();
          setTtsStatus(group, "Paused");
        });
      group
        .querySelector("[data-action='replay']")
        ?.addEventListener("click", () => speak(text, group));
      group
        .querySelector("[data-action='stop']")
        ?.addEventListener("click", () => {
          speechSynthesis.cancel();
          setTtsStatus(group, "Stopped");
        });
    });
  }

  function speak(text, group) {
    if (!("speechSynthesis" in window))
      return toast("Text-to-speech is not supported by this browser.");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setTtsStatus(group, "Playing");
    utterance.onend = () => setTtsStatus(group, "Ready");
    utterance.onerror = () => setTtsStatus(group, "Unable to play");
    speechSynthesis.speak(utterance);
  }

  function setTtsStatus(group, text) {
    const status = group.querySelector(".tts-status");
    if (status) status.textContent = text;
  }

  function ttsMarkup(text) {
    return `<div class="tts-controls" data-tts="${encodeURIComponent(text)}"><button data-action="play">Play</button><button data-action="pause">Pause</button><button data-action="replay">Replay</button><button data-action="stop">Stop</button><span class="tts-status">Ready</span></div>`;
  }

  function pageHeader(title, desc) {
    return `<div class="page-header"><p>PRIVATE WORKSPACE</p><h1>${escapeHtml(title)}</h1><span>${escapeHtml(desc)}</span></div>`;
  }

  function toggle(id, label, checked) {
    return `<label class="switch-row"><span>${escapeHtml(label)}</span><input id="${id}" type="checkbox" ${checked ? "checked" : ""}></label>`;
  }

  function empty(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function listPreview(items, limit) {
    return `<div class="item-list">${items
      .slice(0, limit)
      .map(
        (item) =>
          `<div class="item-row"><div><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.created_at)}</small></div></div>`,
      )
      .join("")}</div>`;
  }

  function fullList(items, key) {
    return `<div class="item-list">${items.map((item) => `<div class="item-row"><div><strong>${escapeHtml(item.title)}</strong>${item.body ? `<div style="color:var(--muted);margin-top:5px;line-height:1.45">${escapeHtml(item.body)}</div>` : ""}<small>${formatDate(item.created_at)}</small></div><button class="link-btn" data-delete="${item.id}">Delete</button></div>`).join("")}</div>`;
  }

  function pageTitleForCollection(key) {
    return (
      {
        prompts: "Saved Prompts",
        projects: "Generator Projects",
        ideas: "Idea Brain",
      }[key] || capitalize(key)
    );
  }

  function openModal(html) {
    document.getElementById("modalBody").innerHTML = html;
    document.getElementById("modal").classList.remove("hidden");
  }
  function closeModal() {
    document.getElementById("modal").classList.add("hidden");
  }

  function openMenu() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("mobileOverlay").classList.add("show");
  }
  function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("mobileOverlay").classList.remove("show");
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /* =========================================================
   GENERATOR FOLDER STORAGE — INDEXEDDB
   ========================================================= */

  function openGeneratorDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("glam_generator_hub_db", 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("generatorFolders")) {
          db.createObjectStore("generatorFolders", {
            keyPath: "id",
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async function saveGeneratorFolderToDatabase(folderRecord) {
    const db = await openGeneratorDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("generatorFolders", "readwrite");

      const store = transaction.objectStore("generatorFolders");

      store.put(folderRecord);

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async function getGeneratorFolderFromDatabase(id) {
    const db = await openGeneratorDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("generatorFolders", "readonly");

      const store = transaction.objectStore("generatorFolders");
      const request = store.get(id);

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async function deleteGeneratorFolderFromDatabase(id) {
    const db = await openGeneratorDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("generatorFolders", "readwrite");

      const store = transaction.objectStore("generatorFolders");

      store.delete(id);

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function loadLocalData() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("glam_command_hub_preview") || "{}",
      );
      return {
        prompts: Array.isArray(saved.prompts) ? saved.prompts : [],
        projects: Array.isArray(saved.projects) ? saved.projects : [],
        ideas: Array.isArray(saved.ideas) ? saved.ideas : [],
        generators: Array.isArray(saved.generators) ? saved.generators : [],
        usage: Array.isArray(saved.usage) ? saved.usage : [],
      };
    } catch (_error) {
      return {
        prompts: [],
        projects: [],
        ideas: [],
        generators: [],
        usage: [],
      };
    }
  }

  function saveLocalData() {
    localStorage.setItem(
      "glam_command_hub_preview",
      JSON.stringify(state.local),
    );
  }
  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  function cryptoId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch (_e) {
      return "";
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  }
  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();

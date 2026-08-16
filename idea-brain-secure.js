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

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3200);
  }

  function readWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data.ideas)) data.ideas = [];
      return data;
    } catch (_error) {
      return { ideas: [] };
    }
  }

  function writeWorkspace(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function getUser() {
    const { data } = await client.auth.getSession();
    return data?.session?.user || null;
  }

  async function saveWorkspace(user, workspace) {
    writeWorkspace(workspace);
    const { error } = await client.from("workspace_state").upsert(
      {
        user_id: user.id,
        data: workspace,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  }

  function messageHistoryForBridge(items) {
    return (items || []).slice(-20).map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.body || "",
    }));
  }

  function buildAttempt(message, history) {
    const recent = messageHistoryForBridge(history);
    if (!recent.length) return message;

    const transcript = recent
      .map((item) => `${item.role === "assistant" ? "Idea Brain" : "User"}: ${item.content}`)
      .join("\n\n");

    return `You are Idea Brain inside GLAM Generator Command Hub. Help the user brainstorm, organize, improve, and develop creative or business ideas. Be practical, specific, encouraging, and concise. Continue naturally from the prior conversation when relevant.\n\nPrior conversation:\n${transcript}\n\nUser's newest idea or question:\n${message}`;
  }

  function extractBridgeReply(data) {
    const directCandidates = [
      data?.reply,
      data?.feedback,
      data?.coaching,
      data?.response,
      data?.output_text,
      data?.text,
      data?.answer,
      data?.content,
      typeof data?.output === "string" ? data.output : "",
      typeof data?.message === "string" ? data.message : "",
      data?.result?.reply,
      data?.result?.feedback,
      data?.result?.response,
      data?.result?.output_text,
      data?.result?.text,
      data?.result?.answer,
      data?.result?.content,
      typeof data?.result === "string" ? data.result : "",
      data?.choices?.[0]?.message?.content,
      data?.choices?.[0]?.text,
      data?.output?.[0]?.content?.[0]?.text,
      data?.output?.[0]?.content?.[0]?.value,
      data?.response?.output_text,
      data?.response?.text,
    ];

    const direct = directCandidates.find(
      (value) => typeof value === "string" && value.trim(),
    );
    if (direct) return direct.trim();

    const strings = [];
    const seen = new Set();
    const preferredKeys = new Set([
      "reply",
      "feedback",
      "coaching",
      "response",
      "output_text",
      "text",
      "answer",
      "content",
      "value",
      "completion",
      "assistant",
      "result",
      "output",
    ]);

    function walk(value, key = "", depth = 0) {
      if (depth > 8 || value == null) return;

      if (typeof value === "string") {
        const clean = value.trim();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        strings.push({
          value: clean,
          score:
            clean.length +
            (preferredKeys.has(String(key).toLowerCase()) ? 10000 : 0),
        });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, key, depth + 1));
        return;
      }

      if (typeof value === "object") {
        Object.entries(value).forEach(([childKey, childValue]) => {
          walk(childValue, childKey, depth + 1);
        });
      }
    }

    walk(data);

    strings.sort((a, b) => b.score - a.score);
    return strings[0]?.value || "";
  }

  async function askIdeaBrain(message, history) {
    const bridgeUrl = String(config.AI_COACH_BRIDGE_URL || "").trim();
    if (!bridgeUrl) throw new Error("AI Coach bridge URL is missing.");

    const attempt = buildAttempt(message, history);

    const response = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attempt,
        message,
        mode: "idea-brain",
        conversationHistory: messageHistoryForBridge(history),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || data?.message || "Idea Brain request failed.");
    }

    const reply = extractBridgeReply(data);
    if (!reply) throw new Error("Idea Brain returned an empty response.");
    return reply;
  }

  async function renderIdeaBrain() {
    const container = document.getElementById("pageContainer");
    if (!container) return;

    const user = await getUser();
    if (!user) return;

    const workspace = readWorkspace();
    const messages = Array.isArray(workspace.ideas) ? workspace.ideas : [];

    document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === "ideas");
    });

    container.innerHTML = `
      <div class="page-header">
        <p>PRIVATE WORKSPACE</p>
        <h1>Idea Brain</h1>
        <span>Develop ideas with your secure AI coach. This conversation is saved to your signed-in workspace.</span>
      </div>

      <section class="card idea-brain-card">
        <div class="card-head">
          <div><h3>Idea Brain Conversation</h3><span class="badge">Secure AI</span></div>
          <button id="secureIdeaClear" class="btn btn-secondary" type="button">Clear Conversation</button>
        </div>

        <div id="secureIdeaMessages" class="idea-brain-messages">
          ${messages.length ? messages.map((message) => `
            <div class="idea-message ${message.role === "assistant" ? "idea-assistant" : "idea-user"}">
              <div class="idea-message-label">${message.role === "assistant" ? "IDEA BRAIN" : "YOU"}</div>
              <div class="idea-message-bubble">${escapeHtml(message.body || "")}</div>
            </div>`).join("") : `
            <div class="idea-brain-empty">
              <span class="badge">Start Here</span>
              <h3>What are you thinking about?</h3>
              <p>Drop a product idea, generator concept, business thought, content concept, or anything you want help developing.</p>
            </div>`}
        </div>

        <form id="secureIdeaForm" class="idea-brain-form">
          <label>Your idea<textarea id="secureIdeaInput" required placeholder="Example: I want to create a generator that helps beginners make premium holiday products..."></textarea></label>
          <div class="form-actions">
            <button id="secureIdeaAsk" class="btn btn-primary" type="submit">Ask Idea Brain</button>
            <button id="secureIdeaSaveOnly" class="btn btn-secondary" type="button">Save Idea Only</button>
          </div>
          <small class="idea-brain-note">Secure AI mode is active. Your OpenAI key stays on the backend.</small>
        </form>
      </section>`;

    requestAnimationFrame(() => {
      const area = document.getElementById("secureIdeaMessages");
      if (area) area.scrollTop = area.scrollHeight;
    });

    const form = document.getElementById("secureIdeaForm");
    const input = document.getElementById("secureIdeaInput");
    const askBtn = document.getElementById("secureIdeaAsk");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input?.value.trim();
      if (!text) return;

      const latest = readWorkspace();
      const priorMessages = Array.isArray(latest.ideas) ? latest.ideas.slice() : [];
      latest.ideas.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        role: "user",
        body: text,
        created_at: new Date().toISOString(),
      });

      try {
        askBtn.disabled = true;
        askBtn.textContent = "Thinking...";
        await saveWorkspace(user, latest);
        const reply = await askIdeaBrain(text, priorMessages);
        latest.ideas.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}a`,
          role: "assistant",
          body: reply,
          created_at: new Date().toISOString(),
        });
        await saveWorkspace(user, latest);
        await renderIdeaBrain();
      } catch (error) {
        console.error("Secure Idea Brain failed:", error);
        toast(error?.message || "Idea Brain could not respond.");
        askBtn.disabled = false;
        askBtn.textContent = "Ask Idea Brain";
      }
    });

    document.getElementById("secureIdeaSaveOnly")?.addEventListener("click", async () => {
      const text = input?.value.trim();
      if (!text) return toast("Type an idea first.");
      const latest = readWorkspace();
      latest.ideas.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        role: "user",
        body: text,
        created_at: new Date().toISOString(),
      });
      try {
        await saveWorkspace(user, latest);
        toast("Idea saved to your private workspace.");
        await renderIdeaBrain();
      } catch (error) {
        toast(error?.message || "Unable to save idea.");
      }
    });

    document.getElementById("secureIdeaClear")?.addEventListener("click", async () => {
      const latest = readWorkspace();
      latest.ideas = [];
      try {
        await saveWorkspace(user, latest);
        await renderIdeaBrain();
        toast("Idea Brain conversation cleared.");
      } catch (error) {
        toast(error?.message || "Unable to clear conversation.");
      }
    });
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("#mainNav [data-page='ideas']");
    if (!nav) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderIdeaBrain().catch((error) => {
      console.error("Idea Brain render failed:", error);
      toast("Unable to open Idea Brain.");
    });
  }, true);
})();
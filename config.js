/*
  GLAM Generator Command Hub — public browser configuration

  Supabase's anon/publishable key is designed to be used in browser apps WHEN
  Row Level Security is enabled. Never put a Supabase service-role key, OpenAI
  key, or any other secret API key in this file.
*/
window.GLAM_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  AI_FUNCTION_NAME: "ai-generate",
  TTS_FUNCTION_NAME: "tts",

  /*
    One shared bridge for the ChatGPT Learning Hub AI Coach.
    Paste the FULL deployed function URL here one time, for example:
    https://YOUR-BRIDGE-SITE.netlify.app/.netlify/functions/coach-bridge

    Do NOT put an OpenAI API key in this file.
  */
  AI_COACH_BRIDGE_URL:
    "https://glam-ai-coaching.netlify.app/.netlify/functions/coach-bridge",
};

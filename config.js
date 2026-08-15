/*
  GLAM Generator Command Hub — public browser configuration

  Supabase's publishable key is designed to be used in browser apps WHEN
  Row Level Security is enabled. Never put a Supabase service-role key,
  OpenAI key, or any other secret API key in this file.
*/
window.GLAM_CONFIG = {
  SUPABASE_URL: "https://zaylygsgbqtulnilcvrg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_9OrEqYDv9NV8E29JakoepA_rIgYDsMk",
  AI_FUNCTION_NAME: "ai-generate",
  TTS_FUNCTION_NAME: "tts",
  AI_COACH_BRIDGE_URL:
    "https://glam-ai-coaching.netlify.app/.netlify/functions/coach-bridge",
};

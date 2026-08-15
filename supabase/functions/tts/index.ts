import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
serve(async ()=>new Response(JSON.stringify({message:'Secure TTS provider adapter placeholder. Browser speech synthesis works in the prototype; server TTS can be added here.'}),{headers:{'content-type':'application/json'}}))

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM = `You are an expert academic tutor. Create a detailed yet concise study summary of the provided content. Use clear headings and bullet points, but avoid any Markdown or decorative formatting characters (no backticks, no code blocks, no leading '#' or '*' characters). Produce plain text suitable for display and audio playback. Do not invent facts not in the source.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";
    const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
    if (!text) return jsonResponse(req, { error: "Missing text" }, 400);
    const truncated = text.slice(0, 60_000);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Title: ${title || "Untitled"}\n\nContent:\n${truncated}` },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "Rate limit, try again in a moment." }, 429);
    if (r.status === 402)
      return json({ error: "AI credits exhausted. Add funds in Workspace settings." }, 402);
    if (!r.ok) {
      console.error("[generate-summary] AI error", r.status, await r.text());
      return jsonResponse(req, { error: "AI service error" }, 500);
    }
    const data = await r.json();
    let summary = data.choices?.[0]?.message?.content ?? "";
    summary = summary.replace(/\s{2,}/g, " ").trim();
    return jsonResponse(req, { summary });
  } catch (e) {
    console.error("[generate-summary] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

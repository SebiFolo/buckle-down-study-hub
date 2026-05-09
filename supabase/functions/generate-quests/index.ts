import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM = `You are an AI that generates short actionable study "quests" for a user. Return a JSON object with two arrays: "daily" and "weekly". Each quest must have: "title" (short), "description" (one sentence), and "xp" (integer). Generate 3 daily quests and 4 weekly quests. Make XP values reasonable (daily: 5-30, weekly: 40-150). Output ONLY valid JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: "Generate quests for this user." },
        ],
      }),
    });
    if (r.status === 429)
      return jsonResponse(req, { error: "Rate limit, try again in a moment." }, 429);
    if (r.status === 402)
      return jsonResponse(
        req,
        { error: "AI credits exhausted. Add funds in Workspace settings." },
        402,
      );
    if (!r.ok) {
      console.error("[generate-quests] AI error", r.status, await r.text());
      return jsonResponse(req, { error: "AI service error" }, 500);
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(raw);
      return jsonResponse(req, { quests: parsed });
    } catch (e) {
      // Try to extract JSON substring
      const j = raw.match(/\{[\s\S]*\}$/m);
      if (j) {
        try {
          const parsed = JSON.parse(j[0]);
          return jsonResponse(req, { quests: parsed });
        } catch (err) {
          console.warn("[generate-quests] JSON substring parse failed", String(err));
        }
      }
      console.error("[generate-quests] parse error", raw);
      return jsonResponse(req, { error: "AI returned non-JSON response" }, 500);
    }
  } catch (e) {
    console.error("[generate-quests] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders({} as Request), "Content-Type": "application/json" },
  });
}

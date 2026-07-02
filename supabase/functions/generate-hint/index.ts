import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { checkAiRateLimit } from "../_shared/rateLimit.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `You are a quiz tutor giving a single helpful hint for a multiple-choice question.

Rules:
- NEVER state or quote the correct answer, paraphrase it, or reveal its first letter / length / position.
- NEVER mention or refer to any of the answer options by name.
- Give ONE short hint (max 20 words) that nudges the student toward the right reasoning: a defining property, category, mechanism, era, or distinguishing trait.
- Example: Q "Which language is compiled?" Options Python, C++, C#, Assembly. Good hint: "Think about which one is translated entirely to machine code before running." Bad hint: "It starts with C."
- Output ONLY the hint sentence. No prefix like "Hint:".`;

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

    const allowed = await checkAiRateLimit(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      u.user.id,
      "generate-hint",
      3600,
      40,
    );
    if (!allowed)
      return jsonResponse(req, { error: "Too many AI requests. Try again in a bit." }, 429);

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.slice(0, 1000) : "";
    const options = Array.isArray(body.options)
      ? (body.options as unknown[]).map((o) => String(o).slice(0, 200)).slice(0, 10)
      : [];
    const correct = typeof body.correct === "string" ? body.correct.slice(0, 200) : "";
    if (!question || !correct || options.length === 0)
      return jsonResponse(req, { error: "Missing question/options/correct" }, 400);

    const userPrompt = `Question: ${question}
Options: ${options.join(" | ")}
Correct answer (do not reveal): ${correct}

Write the hint.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
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
      console.error("[generate-hint] AI error", r.status, await r.text());
      return jsonResponse(req, { error: "AI service error" }, 500);
    }
    const data = await r.json();
    const hint = (data.choices?.[0]?.message?.content ?? "").trim();
    return jsonResponse(req, { hint });
  } catch (e) {
    console.error("[generate-hint] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

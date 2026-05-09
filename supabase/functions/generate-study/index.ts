import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "quiz" ? "quiz" : body.mode === "flashcards" ? "flashcards" : null;
    const text = typeof body.text === "string" ? body.text : "";
    if (!mode) return jsonResponse(req, { error: "Invalid mode" }, 400);
    if (!text) return jsonResponse(req, { error: "Missing text" }, 400);
    const truncated = text.slice(0, 50_000);

    const isQuiz = mode === "quiz";
    const tool = isQuiz
      ? {
          type: "function",
          function: {
            name: "create_quiz",
            description: "Create 5-10 multiple choice questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                      correct_answer: { type: "string", description: "Must exactly match one of the options" },
                    },
                    required: ["question", "options", "correct_answer"],
                    additionalProperties: false,
                  },
                  minItems: 5,
                  maxItems: 10,
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }
      : {
          type: "function",
          function: {
            name: "create_flashcards",
            description: "Create 10-15 flashcards",
            parameters: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      front: { type: "string" },
                      back: { type: "string" },
                    },
                    required: ["front", "back"],
                    additionalProperties: false,
                  },
                  minItems: 8,
                  maxItems: 15,
                },
              },
              required: ["cards"],
              additionalProperties: false,
            },
          },
        };

    const sys = isQuiz
      ? "Generate clear multiple choice questions from the source. Each question has exactly 4 plausible options. correct_answer must be one of the options verbatim."
      : "Generate concise flashcards. Front = a question or term. Back = a short, clear answer or definition.";

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: truncated },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });
    if (r.status === 429) return jsonResponse(req, { error: "Rate limit, try again in a moment." }, 429);
    if (r.status === 402) return jsonResponse(req, { error: "AI credits exhausted." }, 402);
    if (!r.ok) {
      console.error("[generate-study] AI error", r.status, await r.text());
      return jsonResponse(req, { error: "AI service error" }, 500);
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return jsonResponse(req, { error: "No structured output" }, 500);
    const parsed = JSON.parse(args);
    return jsonResponse(req, parsed);
  } catch (e) {
    console.error("[generate-study] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

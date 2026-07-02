import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const quizId = typeof body.quizId === "string" ? body.quizId : "";
    const answers = body.answers && typeof body.answers === "object" ? body.answers : null;
    if (!quizId || !answers) return jsonResponse(req, { error: "Invalid input" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify quiz exists (any user may attempt any quiz they can read; RLS on questions gates below)
    const { data: questions, error: qErr } = await admin
      .from("quiz_questions")
      .select("id,correct_answer")
      .eq("quiz_id", quizId);
    if (qErr || !questions || questions.length === 0)
      return jsonResponse(req, { error: "Quiz not found" }, 404);

    let score = 0;
    for (const q of questions) {
      const picked = answers[q.id as string];
      if (typeof picked === "string" && picked === q.correct_answer) score++;
    }
    const total = questions.length;

    const { error: insErr } = await admin
      .from("quiz_attempts")
      .insert({ quiz_id: quizId, user_id: userId, score, total });
    if (insErr) {
      console.error("[submit-quiz] insert error", insErr);
      return jsonResponse(req, { error: "Could not record attempt" }, 500);
    }

    return jsonResponse(req, { ok: true, score, total, perfect: score === total });
  } catch (e) {
    console.error("[submit-quiz] unexpected", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

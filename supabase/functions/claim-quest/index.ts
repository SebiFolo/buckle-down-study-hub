import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { QUESTS, periodKey, periodStartIso } from "../_shared/quests.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function computeProgress(
  admin: ReturnType<typeof createClient>,
  userId: string,
  questKey: string,
): Promise<number> {
  const def = QUESTS.find((q) => q.key === questKey);
  if (!def) return 0;
  const startIso = periodStartIso(def.period);

  switch (questKey) {
    case "daily_quiz":
    case "weekly_quizzes": {
      const { count } = await admin
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("completed_at", startIso);
      return count ?? 0;
    }
    case "weekly_perfect": {
      const { data } = await admin
        .from("quiz_attempts")
        .select("score,total")
        .eq("user_id", userId)
        .gte("completed_at", startIso);
      return (data || []).some((r) => r.score === r.total && r.total > 0) ? 1 : 0;
    }
    case "daily_summary":
    case "weekly_summaries": {
      const { count } = await admin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("summary", "is", null)
        .gte("created_at", startIso);
      return count ?? 0;
    }
    case "daily_flashset": {
      const { count } = await admin
        .from("flashcard_sets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startIso);
      return count ?? 0;
    }
    case "weekly_share": {
      const { count } = await admin
        .from("shared_documents")
        .select("id", { count: "exact", head: true })
        .eq("shared_by_user_id", userId)
        .gte("created_at", startIso);
      return count ?? 0;
    }
    case "weekly_friend": {
      const { count } = await admin
        .from("friends")
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .gte("updated_at", startIso);
      return count ?? 0;
    }
  }
  return 0;
}

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
    const questKey = String(body.questKey || "");
    const def = QUESTS.find((q) => q.key === questKey);
    if (!def) return jsonResponse(req, { error: "Unknown quest" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pKey = periodKey(def.period);

    // Already claimed?
    const { data: existing } = await admin
      .from("quest_claims")
      .select("id")
      .eq("user_id", userId)
      .eq("quest_key", questKey)
      .eq("period_key", pKey)
      .maybeSingle();
    if (existing) return jsonResponse(req, { error: "Already claimed" }, 400);

    const progress = await computeProgress(admin, userId, questKey);
    if (progress < def.goal)
      return jsonResponse(req, { error: "Quest not complete", progress, goal: def.goal }, 400);

    // Insert claim (unique constraint guards races)
    const { error: claimErr } = await admin
      .from("quest_claims")
      .insert({ user_id: userId, quest_key: questKey, period_key: pKey });
    if (claimErr) {
      console.error("[claim-quest] insert error", claimErr);
      return jsonResponse(req, { error: "Already claimed" }, 400);
    }

    // Award XP + coins
    const { data: profile } = await admin
      .from("profiles")
      .select("xp,level,coins")
      .eq("id", userId)
      .single();
    if (!profile) return jsonResponse(req, { error: "Profile not found" }, 404);

    const newXp = (profile.xp ?? 0) + def.xp;
    const newCoins = (profile.coins ?? 0) + def.coins;

    // Level recompute
    const thresholdForLevel = (level: number): number => {
      if (level <= 1) return 0;
      let total = 0;
      let delta = 200;
      for (let l = 2; l <= level; l++) {
        total += delta;
        delta = l < 5 ? delta + 100 : delta + 150;
      }
      return total;
    };
    const levelFromXp = (xp: number): number => {
      let lvl = 1;
      while (thresholdForLevel(lvl + 1) <= xp) lvl++;
      return lvl;
    };
    const newLevel = levelFromXp(newXp);

    await admin
      .from("profiles")
      .update({ xp: newXp, level: newLevel, coins: newCoins })
      .eq("id", userId);

    await admin
      .from("xp_events")
      .insert({ user_id: userId, amount: def.xp, reason: `quest:${questKey}` });

    return jsonResponse(req, {
      ok: true,
      xpAwarded: def.xp,
      coinsAwarded: def.coins,
      newXp,
      newLevel,
      newCoins,
      leveledUp: newLevel > (profile.level ?? 1),
    });
  } catch (e) {
    console.error("[claim-quest] unexpected", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

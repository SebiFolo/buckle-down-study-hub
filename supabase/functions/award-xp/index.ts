import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_REASONS = new Set([
  "summary",
  "flashcards",
  "flashcard_set",
  "quiz",
  "quiz_perfect",
  "friend_accept",
  "share_summary",
  "daily_streak",
]);
// Reasons that count toward the daily streak
const STREAK_REASONS = new Set(["quiz", "summary"]);
const PER_CALL_CAP = 200;
const DAILY_CAP = 500;

function thresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  let delta = 200;
  for (let l = 2; l <= level; l++) {
    total += delta;
    delta = l < 5 ? delta + 100 : delta + 150;
  }
  return total;
}
function levelFromXp(xp: number): number {
  let lvl = 1;
  while (thresholdForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
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
    const reason = String(body.reason || "");
    if (!ALLOWED_REASONS.has(reason)) return jsonResponse(req, { error: "Invalid reason" }, 400);

    let xp = Math.floor(Number(body.amount) || 0);
    if (xp <= 0) return jsonResponse(req, { error: "Invalid amount" }, 400);
    xp = Math.min(xp, PER_CALL_CAP);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: dailyData } = await admin.rpc("daily_xp_total", { _user_id: userId });
    const todayTotal = Number(dailyData) || 0;
    const remaining = Math.max(0, DAILY_CAP - todayTotal);
    xp = Math.min(xp, remaining);
    if (xp <= 0) return jsonResponse(req, { awarded: 0, dailyCapReached: true });

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("xp, level, streak_count, longest_streak, last_active_date")
      .eq("id", userId)
      .single();
    if (pErr || !profile) return jsonResponse(req, { error: "Profile not found" }, 404);

    const today = new Date().toISOString().slice(0, 10);
    const last = profile.last_active_date as string | null;
    let streak = profile.streak_count ?? 0;
    let longest = profile.longest_streak ?? 0;
    let streakBonus = 0;
    let freezeUsed = false;

    // Only quiz/summary actions advance the streak.
    if (STREAK_REASONS.has(reason) && last !== today) {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      if (last === yStr || !last) {
        streak = (last === yStr ? streak : 0) + 1;
      } else {
        // Gap > 1 day: try to consume a streak freeze
        const { data: freezeRow } = await admin
          .from("inventory")
          .select("quantity")
          .eq("user_id", userId)
          .eq("item_key", "streak_freeze")
          .maybeSingle();
        if (freezeRow && (freezeRow.quantity ?? 0) > 0) {
          await admin
            .from("inventory")
            .update({
              quantity: (freezeRow.quantity ?? 0) - 1,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("item_key", "streak_freeze");
          freezeUsed = true;
          streak = streak + 1;
        } else {
          streak = 1;
        }
      }

      streakBonus = Math.min(10, Math.max(0, DAILY_CAP - todayTotal - xp));
      if (streak > longest) longest = streak;
    }

    const newXp = profile.xp + xp + streakBonus;
    const oldLevel = profile.level;
    const newLevel = levelFromXp(newXp);

    // Only bump last_active_date when a streak-eligible action occurs
    const updatePayload: Record<string, unknown> = {
      xp: newXp,
      level: newLevel,
      streak_count: streak,
      longest_streak: longest,
    };
    if (STREAK_REASONS.has(reason)) updatePayload.last_active_date = today;

    const { error: upErr } = await admin.from("profiles").update(updatePayload).eq("id", userId);
    if (upErr) {
      console.error("[award-xp] profile update error", upErr);
      return jsonResponse(req, { error: "Internal server error" }, 500);
    }

    await admin.from("xp_events").insert({ user_id: userId, amount: xp, reason });
    if (streakBonus)
      await admin
        .from("xp_events")
        .insert({ user_id: userId, amount: streakBonus, reason: "daily_streak" });

    return jsonResponse(req, {
      awarded: xp,
      streakBonus,
      newXp,
      newLevel,
      leveledUp: newLevel > oldLevel,
      streak,
      freezeUsed,
    });
  } catch (e) {
    console.error("[award-xp] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

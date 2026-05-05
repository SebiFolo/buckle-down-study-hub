import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// XP and leveling — must mirror src/lib/leveling.ts
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
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const { amount, reason } = await req.json();
    const xp = Math.max(0, Math.min(2000, Number(amount) || 0));
    if (!xp) return json({ error: "Invalid amount" }, 400);

    // Use service role for atomic profile update + xp_event log
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("xp, level, streak_count, longest_streak, last_active_date")
      .eq("id", userId)
      .single();
    if (pErr || !profile) return json({ error: "Profile not found" }, 404);

    // Streak logic
    const today = new Date().toISOString().slice(0, 10);
    const last = profile.last_active_date as string | null;
    let streak = profile.streak_count ?? 0;
    let longest = profile.longest_streak ?? 0;
    let streakBonus = 0;

    if (last !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      if (last === yStr) streak += 1;
      else streak = 1;
      streakBonus = 10;
      if (streak > longest) longest = streak;
    }

    const newXp = profile.xp + xp + streakBonus;
    const oldLevel = profile.level;
    const newLevel = levelFromXp(newXp);

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        xp: newXp,
        level: newLevel,
        streak_count: streak,
        longest_streak: longest,
        last_active_date: today,
      })
      .eq("id", userId);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("xp_events").insert({ user_id: userId, amount: xp, reason });
    if (streakBonus) await admin.from("xp_events").insert({ user_id: userId, amount: streakBonus, reason: "daily_streak" });

    return json({
      awarded: xp,
      streakBonus,
      newXp,
      newLevel,
      leveledUp: newLevel > oldLevel,
      streak,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

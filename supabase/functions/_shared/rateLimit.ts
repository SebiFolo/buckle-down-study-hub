// Per-user, per-function sliding-window rate limiter backed by the
// `check_ai_rate_limit` Postgres function. Used to cap how often a single
// account can call the (paid) AI gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function checkAiRateLimit(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  fnName: string,
  windowSeconds: number,
  maxCalls: number,
): Promise<boolean> {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc("check_ai_rate_limit", {
    _user_id: userId,
    _fn_name: fnName,
    _window_seconds: windowSeconds,
    _max_calls: maxCalls,
  });
  if (error) {
    console.error(`[rateLimit:${fnName}] check failed`, error);
    return true; // fail open: a rate-limit infra hiccup shouldn't take down the feature
  }
  return Boolean(data);
}

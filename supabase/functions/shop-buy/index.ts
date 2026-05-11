import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { SHOP_ITEMS } from "../_shared/shop.ts";

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
    const action = String(body.action || "buy");
    const itemKey = String(body.itemKey || "");
    const item = SHOP_ITEMS.find((i) => i.key === itemKey);
    if (!item) return jsonResponse(req, { error: "Unknown item" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();
    if (!profile) return jsonResponse(req, { error: "Profile not found" }, 404);

    const { data: invRow } = await admin
      .from("inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_key", itemKey)
      .maybeSingle();
    const currentQty = invRow?.quantity ?? 0;

    if (action === "consume") {
      if (currentQty < 1) return jsonResponse(req, { error: "None in inventory" }, 400);
      await admin
        .from("inventory")
        .update({ quantity: currentQty - 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("item_key", itemKey);
      return jsonResponse(req, { ok: true, newQty: currentQty - 1 });
    }

    // buy
    if (item.maxStack && currentQty >= item.maxStack)
      return jsonResponse(req, { error: `Max ${item.maxStack} owned` }, 400);
    if ((profile.coins ?? 0) < item.cost)
      return jsonResponse(req, { error: "Not enough coins" }, 400);

    const newCoins = (profile.coins ?? 0) - item.cost;
    await admin.from("profiles").update({ coins: newCoins }).eq("id", userId);

    if (invRow) {
      await admin
        .from("inventory")
        .update({ quantity: currentQty + 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("item_key", itemKey);
    } else {
      await admin
        .from("inventory")
        .insert({ user_id: userId, item_key: itemKey, quantity: 1 });
    }

    return jsonResponse(req, { ok: true, newCoins, newQty: currentQty + 1 });
  } catch (e) {
    console.error("[shop-buy] unexpected", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

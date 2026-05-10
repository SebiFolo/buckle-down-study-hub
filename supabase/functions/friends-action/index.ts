import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER_RE = /^[a-zA-Z0-9._@+-]{1,255}$/;
const ALLOWED_ACTIONS = new Set([
  "find",
  "request",
  "accept",
  "reject",
  "list",
  "incoming",
  "outgoing",
  "unfriend",
  "cancel",
  "share",
  "shared_received",
  "shared_sent",
]);

function thresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0,
    delta = 200;
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

async function awardXp(
  admin: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  reason: string,
) {
  const { data: p } = await admin.from("profiles").select("xp, level").eq("id", userId).single();
  if (!p) return;
  const newXp = p.xp + amount;
  const newLevel = levelFromXp(newXp);
  await admin.from("profiles").update({ xp: newXp, level: newLevel }).eq("id", userId);
  await admin.from("xp_events").insert({ user_id: userId, amount, reason });
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
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (!ALLOWED_ACTIONS.has(action)) return jsonResponse(req, { error: "Invalid action" }, 400);

    // Common validators
    const getUuid = (v: unknown): string | null => {
      const s = String(v || "");
      return UUID_RE.test(s) ? s : null;
    };

    if (action === "find") {
      const identifier = String(body.identifier || "").trim();
      if (!identifier || !IDENTIFIER_RE.test(identifier))
        return jsonResponse(req, { error: "Invalid identifier" }, 400);

      let { data: prof } = await admin
        .from("profiles")
        .select("id, username, avatar_url, level, xp, streak_count")
        .ilike("username", identifier)
        .maybeSingle();

      if (!prof && identifier.includes("@")) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list?.users?.find(
          (x: { email?: string }) => x.email?.toLowerCase() === identifier.toLowerCase(),
        );
        if (match) {
          const { data: p2 } = await admin
            .from("profiles")
            .select("id, username, avatar_url, level, xp, streak_count")
            .eq("id", match.id)
            .maybeSingle();
          prof = p2;
        }
      }

      if (!prof) return jsonResponse(req, { error: "User not found" }, 404);
      if (prof.id === userId) return jsonResponse(req, { error: "You cannot add yourself" }, 400);

      const { data: existing } = await admin
        .from("friends")
        .select("id, status, requester_id, addressee_id")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${prof.id}),and(requester_id.eq.${prof.id},addressee_id.eq.${userId})`,
        )
        .maybeSingle();

      return jsonResponse(req, { user: prof, relationship: existing || null });
    }

    if (action === "request") {
      const targetId = getUuid(body.targetId);
      if (!targetId || targetId === userId)
        return jsonResponse(req, { error: "Invalid target" }, 400);
      const { data: existing } = await admin
        .from("friends")
        .select("id, status")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`,
        )
        .maybeSingle();
      if (existing)
        return jsonResponse(
          req,
          { error: existing.status === "accepted" ? "Already friends" : "Request already exists" },
          400,
        );
      const { error } = await admin
        .from("friends")
        .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
      if (error) {
        console.error("[friends-action] request insert error", error);
        return jsonResponse(req, { error: "Could not send request" }, 500);
      }
      return jsonResponse(req, { ok: true });
    }

    if (action === "accept") {
      const friendRowId = getUuid(body.friendRowId);
      if (!friendRowId) return jsonResponse(req, { error: "Invalid id" }, 400);
      const { data: row } = await admin
        .from("friends")
        .select("*")
        .eq("id", friendRowId)
        .maybeSingle();
      if (!row || row.addressee_id !== userId || row.status !== "pending")
        return jsonResponse(req, { error: "Invalid request" }, 400);
      await admin
        .from("friends")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", friendRowId);
      await awardXp(admin, row.requester_id, 15, "friend_accept");
      await awardXp(admin, row.addressee_id, 15, "friend_accept");
      return jsonResponse(req, { ok: true });
    }

    if (action === "reject") {
      const friendRowId = getUuid(body.friendRowId);
      if (!friendRowId) return jsonResponse(req, { error: "Invalid id" }, 400);
      const { data: row } = await admin
        .from("friends")
        .select("*")
        .eq("id", friendRowId)
        .maybeSingle();
      if (!row || row.addressee_id !== userId)
        return jsonResponse(req, { error: "Invalid request" }, 400);
      await admin.from("friends").delete().eq("id", friendRowId);
      return jsonResponse(req, { ok: true });
    }

    if (action === "list") {
      const { data: rows } = await admin
        .from("friends")
        .select("id, requester_id, addressee_id, created_at")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      const ids = (rows || []).map((r: { requester_id: string; addressee_id: string }) =>
        r.requester_id === userId ? r.addressee_id : r.requester_id,
      );
      if (!ids.length) return jsonResponse(req, { friends: [] });
      const { data: profs } = await admin
        .from("profiles")
        .select("id, username, avatar_url, level, xp, streak_count, last_active_date")
        .in("id", ids);
      const byId = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
      const friends = (rows || [])
        .map((r: { requester_id: string; addressee_id: string; id: string }) => {
          const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
          return { friendRowId: r.id, ...byId.get(otherId) };
        })
        .filter((f: { id?: string }) => f.id);
      return jsonResponse(req, { friends });
    }

    if (action === "incoming") {
      const { data: rows } = await admin
        .from("friends")
        .select("id, requester_id, created_at")
        .eq("addressee_id", userId)
        .eq("status", "pending");
      const ids = (rows || []).map((r: { requester_id: string }) => r.requester_id);
      const { data: profs } = ids.length
        ? await admin
            .from("profiles")
            .select("id, username, avatar_url, level, streak_count")
            .in("id", ids)
        : { data: [] };
      const byId = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
      return jsonResponse(req, {
        requests: (rows || []).map(
          (r: { id: string; created_at: string; requester_id: string }) => ({
            friendRowId: r.id,
            created_at: r.created_at,
            ...byId.get(r.requester_id),
          }),
        ),
      });
    }

    if (action === "outgoing") {
      const { data: rows } = await admin
        .from("friends")
        .select("id, addressee_id, created_at")
        .eq("requester_id", userId)
        .eq("status", "pending");
      const ids = (rows || []).map((r: { addressee_id: string }) => r.addressee_id);
      const { data: profs } = ids.length
        ? await admin
            .from("profiles")
            .select("id, username, avatar_url, level, streak_count")
            .in("id", ids)
        : { data: [] };
      const byId = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
      return jsonResponse(req, {
        requests: (rows || []).map(
          (r: { id: string; created_at: string; addressee_id: string }) => ({
            friendRowId: r.id,
            created_at: r.created_at,
            ...byId.get(r.addressee_id),
          }),
        ),
      });
    }

    if (action === "unfriend") {
      const otherId = getUuid(body.targetId);
      if (!otherId) return jsonResponse(req, { error: "Invalid id" }, 400);
      await admin
        .from("friends")
        .delete()
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
        );
      await admin
        .from("shared_documents")
        .delete()
        .or(
          `and(shared_by_user_id.eq.${userId},shared_with_user_id.eq.${otherId}),and(shared_by_user_id.eq.${otherId},shared_with_user_id.eq.${userId})`,
        );
      return jsonResponse(req, { ok: true });
    }

    if (action === "cancel") {
      const friendRowId = getUuid(body.friendRowId);
      if (!friendRowId) return jsonResponse(req, { error: "Invalid id" }, 400);
      const { data: row } = await admin
        .from("friends")
        .select("*")
        .eq("id", friendRowId)
        .maybeSingle();
      if (!row || row.requester_id !== userId) return jsonResponse(req, { error: "Invalid" }, 400);
      await admin.from("friends").delete().eq("id", friendRowId);
      return jsonResponse(req, { ok: true });
    }

    if (action === "share") {
      const documentId = getUuid(body.documentId);
      const friendId = getUuid(body.friendId);
      if (!documentId || !friendId) return jsonResponse(req, { error: "Invalid ids" }, 400);
      const { data: doc } = await admin
        .from("documents")
        .select("id, user_id, title")
        .eq("id", documentId)
        .maybeSingle();
      if (!doc || doc.user_id !== userId)
        return jsonResponse(req, { error: "Not your document" }, 403);
      const { data: fr } = await admin
        .from("friends")
        .select("id, status")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
        )
        .eq("status", "accepted")
        .maybeSingle();
      if (!fr) return jsonResponse(req, { error: "Not friends" }, 400);
      const { error } = await admin.from("shared_documents").insert({
        document_id: documentId,
        shared_by_user_id: userId,
        shared_with_user_id: friendId,
      });
      if (error) {
        if (error.code === "23505")
          return jsonResponse(req, { error: "Already shared with this friend" }, 400);
        console.error("[friends-action] share insert error", error);
        return jsonResponse(req, { error: "Could not share document" }, 500);
      }
      await awardXp(admin, userId, 10, "share_summary");
      return jsonResponse(req, { ok: true });
    }

    if (action === "shared_received") {
      const { data: rows } = await admin
        .from("shared_documents")
        .select("id, created_at, shared_by_user_id, documents(title, summary, file_type)")
        .eq("shared_with_user_id", userId)
        .order("created_at", { ascending: false });
      const ids = Array.from(
        new Set((rows || []).map((r: { shared_by_user_id: string }) => r.shared_by_user_id)),
      );
      const { data: profs } = ids.length
        ? await admin.from("profiles").select("id, username, avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
      return jsonResponse(req, {
        items: (rows || []).map(
          (r: {
            id: string;
            created_at: string;
            shared_by_user_id: string;
            documents: unknown;
          }) => ({
            id: r.id,
            created_at: r.created_at,
            sharedBy: byId.get(r.shared_by_user_id),
            document: r.documents,
          }),
        ),
      });
    }

    if (action === "shared_sent") {
      const { data: rows } = await admin
        .from("shared_documents")
        .select("id, created_at, shared_with_user_id, documents(id, title, file_type)")
        .eq("shared_by_user_id", userId)
        .order("created_at", { ascending: false });
      const ids = Array.from(
        new Set((rows || []).map((r: { shared_with_user_id: string }) => r.shared_with_user_id)),
      );
      const { data: profs } = ids.length
        ? await admin.from("profiles").select("id, username, avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
      return jsonResponse(req, {
        items: (rows || []).map(
          (r: {
            id: string;
            created_at: string;
            shared_with_user_id: string;
            documents: unknown;
          }) => ({
            id: r.id,
            created_at: r.created_at,
            sharedWith: byId.get(r.shared_with_user_id),
            document: r.documents,
          }),
        ),
      });
    }

    return jsonResponse(req, { error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[friends-action] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, Loader2, Coins, Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QUESTS, periodKey, periodStartIso, type QuestDef } from "@/lib/quests";

export const Route = createFileRoute("/quests")({ component: QuestsPage });

interface ClaimRow {
  quest_key: string;
  period_key: string;
}

function QuestsPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [user, authLoading, nav]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const dailyStart = periodStartIso("daily");
    const weeklyStart = periodStartIso("weekly");

    const [
      quizzesDailyRes,
      quizzesWeeklyRes,
      perfectRes,
      summariesDailyRes,
      summariesWeeklyRes,
      flashSetsDailyRes,
      sharesWeeklyRes,
      friendsWeeklyRes,
      claimsRes,
      profileRes,
    ] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .gte("completed_at", dailyStart),
      supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .gte("completed_at", weeklyStart),
      supabase
        .from("quiz_attempts")
        .select("score,total")
        .gte("completed_at", weeklyStart),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .not("summary", "is", null)
        .gte("created_at", dailyStart),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .not("summary", "is", null)
        .gte("created_at", weeklyStart),
      supabase
        .from("flashcard_sets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dailyStart),
      supabase
        .from("shared_documents")
        .select("id", { count: "exact", head: true })
        .eq("shared_by_user_id", user.id)
        .gte("created_at", weeklyStart),
      supabase
        .from("friends")
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .gte("updated_at", weeklyStart),
      supabase.from("quest_claims").select("quest_key,period_key"),
      supabase.from("profiles").select("coins").eq("id", user.id).single(),
    ]);

    const perfect = (perfectRes.data || []).some(
      (r) => r.score === r.total && (r.total ?? 0) > 0,
    )
      ? 1
      : 0;

    setProgress({
      daily_quiz: quizzesDailyRes.count ?? 0,
      daily_summary: summariesDailyRes.count ?? 0,
      daily_flashset: flashSetsDailyRes.count ?? 0,
      weekly_quizzes: quizzesWeeklyRes.count ?? 0,
      weekly_perfect: perfect,
      weekly_share: sharesWeeklyRes.count ?? 0,
      weekly_friend: friendsWeeklyRes.count ?? 0,
      weekly_summaries: summariesWeeklyRes.count ?? 0,
    });

    const claimSet = new Set<string>();
    (claimsRes.data as ClaimRow[] | null)?.forEach((c) => {
      claimSet.add(`${c.quest_key}:${c.period_key}`);
    });
    setClaims(claimSet);
    setCoins(profileRes.data?.coins ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const claim = async (q: QuestDef) => {
    setClaiming(q.key);
    try {
      const { data, error } = await supabase.functions.invoke("claim-quest", {
        body: { questKey: q.key },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`+${data.xpAwarded} XP · +${data.coinsAwarded} 🪙`);
      if (data.leveledUp) toast.success(`🎉 Level up! Now Level ${data.newLevel}`);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't claim");
    } finally {
      setClaiming(null);
    }
  };

  if (!user) return null;

  const daily = QUESTS.filter((q) => q.period === "daily");
  const weekly = QUESTS.filter((q) => q.period === "weekly");

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" /> Quests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Daily quests reset every day · Weekly quests reset every Monday.
            </p>
          </div>
          <div className="buck-card px-4 py-2 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-semibold">{coins}</span>
            <span className="text-xs text-muted-foreground">coins</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading quests...
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            <QuestColumn
              title="Daily"
              quests={daily}
              progress={progress}
              claims={claims}
              onClaim={claim}
              claiming={claiming}
            />
            <QuestColumn
              title="Weekly"
              quests={weekly}
              progress={progress}
              claims={claims}
              onClaim={claim}
              claiming={claiming}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuestColumn({
  title,
  quests,
  progress,
  claims,
  onClaim,
  claiming,
}: {
  title: string;
  quests: QuestDef[];
  progress: Record<string, number>;
  claims: Set<string>;
  onClaim: (q: QuestDef) => void;
  claiming: string | null;
}) {
  return (
    <div>
      <h2 className="font-semibold mb-3 text-lg">{title}</h2>
      <ul className="space-y-3">
        {quests.map((q) => {
          const cur = Math.min(progress[q.key] ?? 0, q.goal);
          const pct = Math.round((cur / q.goal) * 100);
          const claimed = claims.has(`${q.key}:${periodKey(q.period)}`);
          const complete = cur >= q.goal;
          return (
            <li key={q.key} className="buck-card p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{q.title}</div>
                  <div className="text-sm text-muted-foreground">{q.description}</div>
                </div>
                <div className="text-xs text-right shrink-0">
                  <div className="font-semibold text-primary">+{q.xp} XP</div>
                  <div className="text-muted-foreground flex items-center gap-1 justify-end">
                    <Coins className="h-3 w-3" /> {q.coins}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Progress value={pct} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {cur}/{q.goal}
                </span>
              </div>
              <div className="mt-3">
                {claimed ? (
                  <Button size="sm" variant="outline" disabled className="w-full">
                    <Check className="h-3 w-3 mr-1" /> Claimed
                  </Button>
                ) : complete ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onClaim(q)}
                    disabled={claiming === q.key}
                  >
                    {claiming === q.key ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    Claim reward
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link to={q.link}>
                      Go do it <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

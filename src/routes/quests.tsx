import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/quests")({ component: QuestsPage });

interface Quest {
  title: string;
  description: string;
  xp: number;
}
interface QuestsData {
  daily: Quest[];
  weekly: Quest[];
}

interface CachedQuests {
  data: QuestsData;
  dailyKey: string; // YYYY-MM-DD
  weeklyKey: string; // YYYY-Www
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function weekKey() {
  const d = new Date();
  // ISO week number
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function QuestsPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [quests, setQuests] = useState<QuestsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [user, authLoading, nav]);

  const cacheKey = user ? `buck.quests.${user.id}` : null;

  const generate = async (mode: "daily" | "weekly" | "both") => {
    if (!user || !cacheKey) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quests");
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const fresh: QuestsData = {
        daily: data.quests?.daily || [],
        weekly: data.quests?.weekly || [],
      };
      const existing = quests || { daily: [], weekly: [] };
      const merged: QuestsData = {
        daily: mode === "weekly" ? existing.daily : fresh.daily,
        weekly: mode === "daily" ? existing.weekly : fresh.weekly,
      };
      setQuests(merged);
      const cached: CachedQuests = {
        data: merged,
        dailyKey: todayKey(),
        weeklyKey: weekKey(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (e: any) {
      toast.error(e.message || "Failed to load quests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !cacheKey) return;
    const raw = localStorage.getItem(cacheKey);
    const today = todayKey();
    const week = weekKey();
    let cached: CachedQuests | null = null;
    try {
      cached = raw ? (JSON.parse(raw) as CachedQuests) : null;
    } catch {
      cached = null;
    }

    const dailyStale = !cached || cached.dailyKey !== today;
    const weeklyStale = !cached || cached.weeklyKey !== week;

    if (cached) setQuests(cached.data);

    if (dailyStale && weeklyStale) generate("both");
    else if (dailyStale) generate("daily");
    else if (weeklyStale) generate("weekly");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" /> Quests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Daily quests refresh every day. Weekly quests refresh every Monday.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generate("both")}
            disabled={loading}
            title="Force refresh"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {loading && !quests ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Generating your quests...
          </div>
        ) : quests ? (
          <div className="grid sm:grid-cols-2 gap-6">
            <QuestColumn title="Daily" quests={quests.daily} />
            <QuestColumn title="Weekly" quests={quests.weekly} />
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">No quests yet.</div>
        )}
      </div>
    </AppShell>
  );
}

function QuestColumn({ title, quests }: { title: string; quests: Quest[] }) {
  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>
      {quests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} quests.</p>
      ) : (
        <ul className="space-y-2">
          {quests.map((q, i) => (
            <li key={i} className="buck-card p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="font-medium">{q.title}</div>
                <div className="text-xs text-muted-foreground shrink-0">{q.xp} XP</div>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{q.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

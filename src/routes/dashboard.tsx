import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BuckLogo } from "@/components/BuckLogo";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { friendsCall } from "@/lib/friends";
import { levelProgress } from "@/lib/leveling";
import { Flame, FolderOpen, BookOpen, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface Profile {
  username: string;
  xp: number;
  level: number;
  streak_count: number;
  last_active_date: string | null;
}

function DashboardPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; title: string; created_at: string; kind: "doc" | "quiz" }>>([]);
  const [activity, setActivity] = useState<Array<{ key: string; text: string }>>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: docs }, { data: quizzes }] = await Promise.all([
        supabase.from("profiles").select("username, xp, level, streak_count, last_active_date").eq("id", user.id).single(),
        supabase.from("documents").select("id, title, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("quiz_attempts").select("id, completed_at, quizzes(title)").order("completed_at", { ascending: false }).limit(3),
      ]);
      if (p) setProfile(p as Profile);
      const items = [
        ...(docs || []).map((d: any) => ({ id: d.id, title: d.title, created_at: d.created_at, kind: "doc" as const })),
        ...(quizzes || []).map((q: any) => ({ id: q.id, title: q.quizzes?.title ?? "Quiz", created_at: q.completed_at, kind: "quiz" as const })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
      setRecent(items);

      // Friends activity
      try {
        const [{ friends }, { items: shared }] = await Promise.all([
          friendsCall<{ friends: any[] }>("list"),
          friendsCall<{ items: any[] }>("shared_received"),
        ]);
        const events: Array<{ key: string; text: string; ts: number }> = [];
        for (const f of friends || []) {
          if (f.level >= 2) events.push({ key: `lvl-${f.id}`, text: `${f.username} reached Level ${f.level}! 🎉`, ts: Date.now() - 1 });
          if (f.streak_count >= 3) events.push({ key: `streak-${f.id}`, text: `${f.username} is on a ${f.streak_count}-day streak! 🔥`, ts: Date.now() - 2 });
        }
        for (const s of shared || []) {
          events.push({
            key: `share-${s.id}`,
            text: `${s.sharedBy?.username || "A friend"} shared a summary with you 📄`,
            ts: +new Date(s.created_at),
          });
        }
        setActivity(events.sort((a, b) => b.ts - a.ts).slice(0, 5));
      } catch {}
    })();
  }, [user]);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const studiedToday = profile?.last_active_date === today;
  const lp = profile ? levelProgress(profile.xp) : null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        {/* Welcome */}
        <div className="buck-card p-6 flex items-center gap-4 bg-gradient-to-br from-card to-accent/30">
          <BuckLogo className="h-14 w-14 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile?.username || "buck"}!</h1>
            <p className="text-sm text-muted-foreground mt-1">Ready to graze some knowledge today?</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {/* Streak */}
          <div className="buck-card p-6">
            <div className="flex items-center gap-3">
              <Flame className={`h-8 w-8 ${studiedToday ? "text-orange-500 fill-orange-500/30" : "text-muted-foreground"}`} />
              <div>
                <div className="text-3xl font-bold">{profile?.streak_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">day streak {studiedToday ? "— kept alive today!" : "— study today to keep it!"}</div>
              </div>
            </div>
          </div>

          {/* Level / XP */}
          <div className="buck-card p-6">
            {lp && (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Level {lp.level}</div>
                    <div className="text-lg font-semibold">{lp.title}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{lp.toNext} XP to next</div>
                </div>
                <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="xp-fill h-full bg-success" style={{ width: `${lp.pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{lp.intoLevel} / {lp.spanLevel} XP</div>
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Link to="/vault" className="buck-card p-5 flex items-center gap-3 hover:border-primary transition">
            <FolderOpen className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">Upload notes</div>
              <div className="text-xs text-muted-foreground">Get an instant AI summary</div>
            </div>
          </Link>
          <Link to="/study" className="buck-card p-5 flex items-center gap-3 hover:border-primary transition">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">Study session</div>
              <div className="text-xs text-muted-foreground">Flashcards & quizzes</div>
            </div>
          </Link>
        </div>

        {/* Recent */}
        <div className="buck-card p-6 mt-4">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — upload a document to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="py-2 flex items-center gap-3 text-sm">
                  {r.kind === "doc" ? <FileText className="h-4 w-4 text-muted-foreground" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Friends Activity */}
        <div className="buck-card p-6 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Friends activity</h2>
            <Link to="/friends" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add friends to see their activity here!</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.key} className="text-sm text-foreground/90">{a.text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

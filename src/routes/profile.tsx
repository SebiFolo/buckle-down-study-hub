import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BuckLogo } from "@/components/BuckLogo";
import { titleForLevel } from "@/lib/leveling";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { count: docCount }, { count: quizCount }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
      ]);
      setStats({ ...p, docCount: docCount ?? 0, quizCount: quizCount ?? 0 });
    })();
  }, [user]);

  if (!user || !stats)
    return (
      <AppShell>
        <div className="p-8">Loading...</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-3xl">
        <div className="buck-card p-6 flex items-center gap-4">
          <BuckLogo className="h-16 w-16 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{stats.username}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm mt-1">
              Level {stats.level} —{" "}
              <span className="text-primary font-medium">{titleForLevel(stats.level)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Stat label="Total XP" value={stats.xp} />
          <Stat label="Current streak" value={`${stats.streak_count} 🔥`} />
          <Stat label="Longest streak" value={stats.longest_streak} />
          <Stat label="Documents" value={stats.docCount} />
          <Stat label="Quizzes taken" value={stats.quizCount} />
          <Stat label="Level" value={stats.level} />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="buck-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

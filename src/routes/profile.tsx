import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { titleForLevel } from "@/lib/leveling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AVATARS, avatarSrc, DEFAULT_AVATAR_KEY } from "@/lib/avatars";
import { Coins, Pencil, ImagePlus, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

interface UserStats {
  username: string;
  level: number;
  xp: number;
  streak_count: number;
  longest_streak: number;
  coins: number;
  avatar_key: string | null;
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<(UserStats & { docCount: number; quizCount: number }) | null>(
    null,
  );
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { count: docCount }, { count: quizCount }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
    ]);
    setStats({ ...(p as UserStats), docCount: docCount ?? 0, quizCount: quizCount ?? 0 });
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveName = async () => {
    if (!user || !nameInput.trim()) return;
    const trimmed = nameInput.trim().slice(0, 30);
    if (trimmed.length < 2) {
      toast.error("Username must be at least 2 characters");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      toast.error("Couldn't update username");
      return;
    }
    toast.success("Username updated");
    setEditName(false);
    await load();
  };

  const saveAvatar = async (key: string) => {
    if (!user) return;
    setSavingAvatar(key);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_key: key })
      .eq("id", user.id);
    setSavingAvatar(null);
    if (error) {
      toast.error("Couldn't update avatar");
      return;
    }
    toast.success("Avatar updated");
    setPickAvatar(false);
    await load();
  };

  if (!user || !stats)
    return (
      <AppShell>
        <div className="p-8">Loading...</div>
      </AppShell>
    );

  const currentAvatarKey = stats.avatar_key ?? DEFAULT_AVATAR_KEY;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-3xl">
        <div className="buck-card p-6 flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setPickAvatar(true)}
            className="relative h-20 w-20 rounded-full overflow-hidden ring-2 ring-primary/40 hover:ring-primary transition group shrink-0"
            aria-label="Change avatar"
          >
            <img
              src={avatarSrc(currentAvatarKey)}
              alt="Your avatar"
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
            <span className="absolute inset-0 bg-black/40 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">
              <ImagePlus className="h-4 w-4" />
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{stats.username}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setNameInput(stats.username);
                  setEditName(true);
                }}
                aria-label="Edit username"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm mt-1">
              Level {stats.level} —{" "}
              <span className="text-primary font-medium">{titleForLevel(stats.level)}</span>
            </p>
          </div>
          <div className="buck-card px-3 py-2 flex items-center gap-2 self-start">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-semibold">{stats.coins ?? 0}</span>
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

        {/* Edit username dialog */}
        <Dialog open={editName} onOpenChange={setEditName}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change username</DialogTitle>
            </DialogHeader>
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={30}
              placeholder="New username"
            />
            <Button onClick={saveName} disabled={savingName} className="w-full">
              {savingName ? "Saving..." : "Save"}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Avatar picker */}
        <Dialog open={pickAvatar} onOpenChange={setPickAvatar}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pick an avatar</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-3">
              {AVATARS.map((a) => {
                const selected = a.key === currentAvatarKey;
                return (
                  <button
                    key={a.key}
                    onClick={() => saveAvatar(a.key)}
                    disabled={savingAvatar !== null}
                    className={`relative aspect-square rounded-full overflow-hidden ring-2 transition ${
                      selected
                        ? "ring-primary"
                        : "ring-transparent hover:ring-primary/60"
                    }`}
                    title={a.label}
                    aria-label={a.label}
                  >
                    <img
                      src={a.src}
                      alt={a.label}
                      className="h-full w-full object-cover"
                      width={128}
                      height={128}
                      loading="lazy"
                    />
                    {selected && (
                      <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="buck-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

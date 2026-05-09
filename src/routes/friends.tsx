import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendsCall } from "@/lib/friends";
import { titleForLevel } from "@/lib/leveling";
import { toast } from "sonner";
import {
  Search,
  Flame,
  UserPlus,
  UserMinus,
  Check,
  X,
  FileText,
  Play,
  Pause,
  Square,
  Send,
} from "lucide-react";
import { BuckLogo } from "@/components/BuckLogo";
import { stripMarkup } from "@/lib/utils";

export const Route = createFileRoute("/friends")({ component: FriendsPage });

interface Friend {
  id: string;
  friendRowId: string;
  username: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak_count: number;
  last_active_date: string | null;
}
interface ReqRow {
  friendRowId: string;
  id: string;
  username: string;
  level: number;
  streak_count: number;
}
interface SharedRecv {
  id: string;
  created_at: string;
  sharedBy: { username: string; avatar_url: string | null } | null;
  document: { title: string; summary: string; file_type: string } | null;
}
interface SharedSent {
  id: string;
  created_at: string;
  sharedWith: { username: string } | null;
  document: { id: string; title: string; file_type: string } | null;
}

function FriendsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);
  if (!user) return null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-1">Friends</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Find study buddies and share what you've learned.
        </p>
        <Tabs defaultValue="friends">
          <TabsList>
            <TabsTrigger value="friends">My Friends</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="shared">Shared Summaries</TabsTrigger>
          </TabsList>
          <TabsContent value="friends" className="mt-4">
            <MyFriendsTab />
          </TabsContent>
          <TabsContent value="requests" className="mt-4">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="shared" className="mt-4">
            <SharedTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function lastActiveLabel(d: string | null) {
  if (!d) return "Active recently";
  const today = new Date().toISOString().slice(0, 10);
  if (d === today) return "Active today";
  const days = Math.floor((+new Date(today) - +new Date(d)) / 86400000);
  return `Active ${days} day${days === 1 ? "" : "s"} ago`;
}

function MyFriendsTab() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ user: any; relationship: any } | null>(null);

  const refresh = async () => {
    try {
      const d = await friendsCall<{ friends: Friend[] }>("list");
      setFriends(d.friends || []);
    } catch {}
  };
  useEffect(() => {
    refresh();
  }, []);

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const d = await friendsCall<{ user: any; relationship: any }>("find", {
        identifier: q.trim(),
      });
      setResult(d);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetId: string) => {
    try {
      await friendsCall("request", { targetId });
      toast.success("Request sent!");
      setResult((r) => (r ? { ...r, relationship: { status: "pending" } } : r));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const unfriend = async (id: string) => {
    if (!confirm("Remove this friend?")) return;
    try {
      await friendsCall("unfriend", { targetId: id });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="buck-card p-4 flex gap-2">
        <Input
          placeholder="Search by username or email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={searching || !q.trim()}>
          <Search className="h-4 w-4 mr-1" /> Search
        </Button>
      </div>

      {result && (
        <div className="buck-card p-4 mt-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-primary font-semibold">
            {result.user.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{result.user.username}</div>
            <div className="text-xs text-muted-foreground">
              Level {result.user.level} · 🔥 {result.user.streak_count}
            </div>
          </div>
          {result.relationship?.status === "accepted" ? (
            <Button size="sm" disabled variant="outline">
              Already friends
            </Button>
          ) : result.relationship?.status === "pending" ? (
            <Button size="sm" disabled variant="outline">
              Pending
            </Button>
          ) : (
            <Button size="sm" onClick={() => sendRequest(result.user.id)}>
              <UserPlus className="h-3 w-3 mr-1" /> Send Request
            </Button>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {friends.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BuckLogo className="h-16 w-16 mx-auto text-primary opacity-60" />
            <p className="mt-4 text-muted-foreground">No friends yet — find a study buddy!</p>
          </div>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="buck-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent ring-2 ring-secondary flex items-center justify-center text-primary font-bold text-lg">
                  {f.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{f.username}</div>
                  <div className="text-xs text-muted-foreground">
                    Level {f.level} · {titleForLevel(f.level)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" /> {f.streak_count}
                </span>
                <span className="text-muted-foreground text-xs">
                  {lastActiveLabel(f.last_active_date)}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.info("Open the Shared tab to see summaries")}
                >
                  Shared Summaries
                </Button>
                <Button size="sm" variant="ghost" onClick={() => unfriend(f.id)}>
                  <UserMinus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RequestsTab() {
  const [incoming, setIncoming] = useState<ReqRow[]>([]);
  const [outgoing, setOutgoing] = useState<ReqRow[]>([]);

  const refresh = async () => {
    try {
      const [i, o] = await Promise.all([
        friendsCall<{ requests: ReqRow[] }>("incoming"),
        friendsCall<{ requests: ReqRow[] }>("outgoing"),
      ]);
      setIncoming(i.requests || []);
      setOutgoing(o.requests || []);
    } catch {}
  };
  useEffect(() => {
    refresh();
  }, []);

  const accept = async (id: string) => {
    try {
      await friendsCall("accept", { friendRowId: id });
      toast.success("Friend added! +15 XP earned 🎉");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const reject = async (id: string) => {
    setIncoming((l) => l.filter((r) => r.friendRowId !== id));
    try {
      await friendsCall("reject", { friendRowId: id });
    } catch (e: any) {
      toast.error(e.message);
      refresh();
    }
  };
  const cancel = async (id: string) => {
    setOutgoing((l) => l.filter((r) => r.friendRowId !== id));
    try {
      await friendsCall("cancel", { friendRowId: id });
    } catch (e: any) {
      toast.error(e.message);
      refresh();
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section>
        <h2 className="font-semibold mb-2">Incoming</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.friendRowId} className="buck-card p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-primary font-semibold">
                  {r.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.username}</div>
                  <div className="text-xs text-muted-foreground">
                    Lvl {r.level} · 🔥 {r.streak_count}
                  </div>
                </div>
                <Button size="sm" onClick={() => accept(r.friendRowId)}>
                  <Check className="h-3 w-3 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reject(r.friendRowId)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="font-semibold mb-2">Outgoing</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((r) => (
              <div key={r.friendRowId} className="buck-card p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-primary font-semibold">
                  {r.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.username}</div>
                  <div className="text-xs text-muted-foreground">Pending...</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancel(r.friendRowId)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SharedTab() {
  const [received, setReceived] = useState<SharedRecv[]>([]);
  const [sent, setSent] = useState<SharedSent[]>([]);
  const [view, setView] = useState<SharedRecv | null>(null);

  const refresh = async () => {
    try {
      const [r, s] = await Promise.all([
        friendsCall<{ items: SharedRecv[] }>("shared_received"),
        friendsCall<{ items: SharedSent[] }>("shared_sent"),
      ]);
      setReceived(r.items || []);
      setSent(s.items || []);
    } catch {}
  };
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section>
        <h2 className="font-semibold mb-2">Received</h2>
        <p className="text-xs text-muted-foreground mb-2">
          View only. Shared summaries can't be re-shared.
        </p>
        {received.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing shared with you yet.</p>
        ) : (
          <div className="space-y-3">
            {received.map((s) => (
              <div key={s.id} className="buck-card p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="font-medium truncate flex-1">
                    {s.document?.title || "Untitled"}
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {s.document?.file_type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  From {s.sharedBy?.username || "friend"} ·{" "}
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setView(s)}>
                    Read Summary
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => speak(s.document?.summary || "")}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Listen 🔊
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="font-semibold mb-2">Sent</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't shared anything yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sent.map((s) => (
              <li key={s.id} className="py-2 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{s.document?.title || "Untitled"}</span>
                <span className="text-xs text-muted-foreground">→ {s.sharedWith?.username}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ReadModal item={view} onClose={() => setView(null)} />
    </div>
  );
}

function speak(text: string) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(stripMarkup(text));
  window.speechSynthesis.speak(u);
}

function ReadModal({ item, onClose }: { item: SharedRecv | null; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!item) return null;
  const text = stripMarkup(item.document?.summary || "");
  const play = () => {
    speak(text);
    setPlaying(true);
  };
  const pause = () => {
    window.speechSynthesis.pause();
    setPlaying(false);
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
  };
  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          stop();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.document?.title}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2">
          Shared by {item.sharedBy?.username}
        </div>
        <div className="flex gap-2 my-2">
          {!playing ? (
            <Button size="sm" onClick={play}>
              <Play className="h-3 w-3 mr-1" /> Listen
            </Button>
          ) : (
            <Button size="sm" onClick={pause}>
              <Pause className="h-3 w-3 mr-1" /> Pause
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={stop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
      </DialogContent>
    </Dialog>
  );
}

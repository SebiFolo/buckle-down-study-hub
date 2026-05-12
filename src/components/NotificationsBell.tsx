import { useEffect, useState } from "react";
import { Bell, Check, X, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { friendsCall } from "@/lib/friends";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface IncomingReq {
  friendRowId: string;
  id: string;
  username: string;
  level: number;
}
interface SharedItem {
  id: string;
  created_at: string;
  sharedBy: { username: string } | null;
  document: { title: string } | null;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingReq[]>([]);
  const [shared, setShared] = useState<SharedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("buck.dismissedNotifs");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const persistDismissed = (s: Set<string>) => {
    localStorage.setItem("buck.dismissedNotifs", JSON.stringify([...s]));
  };

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      persistDismissed(next);
      return next;
    });
  };

  const refresh = async () => {
    if (!user) return;
    try {
      const [inc, sh] = await Promise.all([
        friendsCall<{ requests: IncomingReq[] }>("incoming"),
        friendsCall<{ items: SharedItem[] }>("shared_received"),
      ]);
      setIncoming(inc.requests || []);
      setShared((sh.items || []).slice(0, 10));
    } catch (error) {
      console.error("Failed to refresh notifications:", error);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [user, refresh]);

  const accept = async (rowId: string) => {
    try {
      await friendsCall("accept", { friendRowId: rowId });
      toast.success("Friend added! +15 XP earned 🎉");
      refresh();
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed to accept request";
      toast.error(error);
    }
  };
  const reject = async (rowId: string) => {
    try {
      await friendsCall("reject", { friendRowId: rowId });
      refresh();
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  };

  const visibleIncoming = incoming.filter((r) => !dismissed.has(`req:${r.friendRowId}`));
  const visibleShared = shared.filter((s) => !dismissed.has(`share:${s.id}`));
  const count = visibleIncoming.length + visibleShared.length;
  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border font-semibold text-sm flex items-center justify-between">
          <span>Notifications</span>
          {count > 0 && (
            <button
              onClick={() => {
                const next = new Set(dismissed);
                visibleIncoming.forEach((r) => next.add(`req:${r.friendRowId}`));
                visibleShared.forEach((s) => next.add(`share:${s.id}`));
                setDismissed(next);
                persistDismissed(next);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {count === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up! 🦌
            </div>
          )}
          {visibleIncoming.map((r) => (
            <div
              key={r.friendRowId}
              className="p-3 border-b border-border flex items-center gap-2 hover:bg-accent/30 transition"
            >
              <Link
                to="/friends"
                search={{ tab: "requests" }}
                onClick={() => setOpen(false)}
                className="flex-1 min-w-0"
              >
                <div className="text-sm">
                  <span className="font-medium">{r.username}</span> wants to be friends
                </div>
                <div className="text-xs text-muted-foreground">Level {r.level}</div>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  accept(r.friendRowId);
                }}
                aria-label="Accept"
              >
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  reject(r.friendRowId);
                }}
                aria-label="Reject"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {visibleShared.map((s) => (
            <div
              key={s.id}
              className="p-3 border-b border-border flex items-center gap-2 hover:bg-accent/30 transition"
            >
              <Link
                to="/friends"
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center gap-2 min-w-0"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0 text-sm truncate">
                  <span className="font-medium">{s.sharedBy?.username || "Friend"}</span> shared{" "}
                  <span>{s.document?.title || "a summary"}</span>
                </div>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismiss(`share:${s.id}`);
                }}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

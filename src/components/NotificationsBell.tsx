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

  const refresh = async () => {
    if (!user) return;
    try {
      const [inc, sh] = await Promise.all([
        friendsCall<{ requests: IncomingReq[] }>("incoming"),
        friendsCall<{ items: SharedItem[] }>("shared_received"),
      ]);
      setIncoming(inc.requests || []);
      setShared((sh.items || []).slice(0, 5));
    } catch {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [user]);

  const accept = async (rowId: string) => {
    try {
      await friendsCall("accept", { friendRowId: rowId });
      toast.success("Friend added! +15 XP earned 🎉");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const reject = async (rowId: string) => {
    try {
      await friendsCall("reject", { friendRowId: rowId });
      refresh();
    } catch {}
  };

  const count = incoming.length + shared.length;
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
        <div className="p-3 border-b border-border font-semibold text-sm">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {count === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up! 🦌
            </div>
          )}
          {incoming.map((r) => (
            <div key={r.friendRowId} className="p-3 border-b border-border flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{r.username}</span> wants to be friends
                </div>
                <div className="text-xs text-muted-foreground">Level {r.level}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => accept(r.friendRowId)}>
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => reject(r.friendRowId)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {shared.map((s) => (
            <Link
              key={s.id}
              to="/friends"
              onClick={() => setOpen(false)}
              className="p-3 border-b border-border flex items-center gap-2 hover:bg-accent/30 transition"
            >
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium">{s.sharedBy?.username || "Friend"}</span> shared{" "}
                <span className="truncate">{s.document?.title || "a summary"}</span>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

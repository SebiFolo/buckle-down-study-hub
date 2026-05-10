import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { friendsCall } from "@/lib/friends";
import { titleForLevel } from "@/lib/leveling";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
}

export function ShareDocumentModal({
  open,
  onClose,
  documentId,
  documentTitle,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
  documentTitle?: string;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareDisabled, setShareDisabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShareDisabled(false);
    friendsCall<{ friends: Friend[] }>("list")
      .then((d) => setFriends(d.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [open]);

  const share = async (friendId: string, name: string) => {
    if (!documentId) return;
    if (shareDisabled) return;
    setSharing(friendId);
    try {
      await friendsCall("share", { documentId, friendId });
      toast.success(`Summary shared with ${name}! +10 XP 🎉`);
      onClose();
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed to share";
      if (error.toLowerCase().includes("not your document")) {
        setShareDisabled(true);
        toast.error("Shared summaries can only be viewed, not reshared.");
        return;
      }
      toast.error(error || "Could not share. Please try again.");
    } finally {
      setSharing(null);
    }
  };

  const filtered = friends.filter((f) => f.username.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share this summary with a friend</DialogTitle>
        </DialogHeader>
        {documentTitle && (
          <p className="text-xs text-muted-foreground -mt-2 truncate">{documentTitle}</p>
        )}

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline" />
          </div>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            You have no friends to share with yet. Add friends first!
          </p>
        ) : (
          <>
            <Input
              placeholder="Search friends..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {filtered.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-2">
                  <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-primary font-semibold">
                    {f.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{f.username}</div>
                    <div className="text-xs text-muted-foreground">
                      Lvl {f.level} · {titleForLevel(f.level)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={sharing === f.id || shareDisabled}
                    onClick={() => share(f.id, f.username)}
                  >
                    {sharing === f.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" /> Share
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

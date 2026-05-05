import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { awardXp } from "@/lib/xp";
import { Upload, FileText, Trash2, Eye, Play, Pause, Square, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/vault")({ component: VaultPage });

interface Doc { id: string; title: string; file_type: string; summary: string | null; created_at: string; }

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md";

function VaultPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [gdoc, setGdoc] = useState("");
  const [view, setView] = useState<Doc | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const refresh = async () => {
    const { data } = await supabase.from("documents").select("id,title,file_type,summary,created_at").order("created_at", { ascending: false });
    setDocs((data as Doc[]) || []);
  };
  useEffect(() => { if (user) refresh(); }, [user]);

  const processFile = async (file: File) => {
    if (!user) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("File too large (max 15MB)");
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx", "pptx", "txt", "md"].includes(ext)) return toast.error("Unsupported file type");

    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      toast.info("🦌 Buckle is reading your notes...");
      const { data: ex, error: exErr } = await supabase.functions.invoke("extract-text", {
        body: { fileBase64: b64, fileType: ext, fileName: file.name },
      });
      if (exErr || ex?.error) throw new Error(ex?.error || exErr?.message);
      const { data: sum, error: sErr } = await supabase.functions.invoke("generate-summary", {
        body: { text: ex.text, title: file.name },
      });
      if (sErr || sum?.error) throw new Error(sum?.error || sErr?.message);

      const { error: insErr } = await supabase.from("documents").insert({
        user_id: user.id,
        title: file.name,
        file_type: ext,
        raw_text: ex.text.slice(0, 200_000),
        summary: sum.summary,
      });
      if (insErr) throw insErr;
      await awardXp(30, "summary");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); }
  };

  const processGdoc = async () => {
    if (!user || !gdoc) return;
    setBusy(true);
    try {
      toast.info("🦌 Fetching your Google Doc...");
      const { data: ex, error: exErr } = await supabase.functions.invoke("extract-text", { body: { gdocUrl: gdoc } });
      if (exErr || ex?.error) throw new Error(ex?.error || exErr?.message);
      const { data: sum, error: sErr } = await supabase.functions.invoke("generate-summary", { body: { text: ex.text, title: "Google Doc" } });
      if (sErr || sum?.error) throw new Error(sum?.error || sErr?.message);
      await supabase.from("documents").insert({
        user_id: user.id, title: "Google Doc — " + new Date().toLocaleDateString(),
        file_type: "gdocs", raw_text: ex.text.slice(0, 200_000), summary: sum.summary,
      });
      await awardXp(30, "summary");
      setGdoc("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.from("documents").delete().eq("id", id);
    await refresh();
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-1">Vault</h1>
        <p className="text-sm text-muted-foreground mb-6">Upload notes and get instant AI summaries.</p>

        {/* Upload */}
        <div
          className="buck-card p-8 text-center border-2 border-dashed border-secondary cursor-pointer hover:bg-accent/20 transition"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
        >
          <Upload className="h-10 w-10 mx-auto text-primary mb-2" />
          <p className="font-medium">{busy ? "🦌 Buckle is reading your notes..." : "Drop a file or click to upload"}</p>
          <p className="text-xs text-muted-foreground mt-1">PDF · DOCX · PPTX · TXT · MD (max 15MB)</p>
          <input
            ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
          />
        </div>

        <div className="buck-card p-4 mt-4 flex gap-2 items-center">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Paste a public Google Docs share link..." value={gdoc} onChange={(e) => setGdoc(e.target.value)} />
          <Button onClick={processGdoc} disabled={busy || !gdoc}>Import</Button>
        </div>

        {/* Library */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {docs.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No documents yet. Upload your first set of notes! 🦌
            </div>
          ) : docs.map((d) => (
            <div key={d.id} className="buck-card p-4 flex flex-col">
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground uppercase">{d.file_type} · {new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{d.summary?.replace(/[#*]/g, "").slice(0, 160)}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setView(d)}><Eye className="h-3 w-3 mr-1" /> View</Button>
                <Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>

        <SummaryModal doc={view} onClose={() => setView(null)} />
      </div>
    </AppShell>
  );
}

function SummaryModal({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!doc) return null;

  const speak = () => {
    if (!doc.summary) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(doc.summary.replace(/[#*_>`]/g, ""));
    u.rate = 1.0;
    u.onend = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };
  const pause = () => { window.speechSynthesis.pause(); setPlaying(false); };
  const stop = () => { window.speechSynthesis.cancel(); setPlaying(false); };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => { if (!o) { stop(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc.title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 my-2">
          {!playing ? (
            <Button size="sm" onClick={speak}><Play className="h-3 w-3 mr-1" /> Listen</Button>
          ) : (
            <Button size="sm" onClick={pause}><Pause className="h-3 w-3 mr-1" /> Pause</Button>
          )}
          <Button size="sm" variant="outline" onClick={stop}><Square className="h-3 w-3 mr-1" /> Stop</Button>
        </div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {doc.summary}
        </div>
      </DialogContent>
    </Dialog>
  );
}

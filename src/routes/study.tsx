import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { awardXp } from "@/lib/xp";
import { fetchInventory, consumeItem } from "@/lib/inventory";
import { Plus, Sparkles, Layers, ListChecks, Lightbulb, Eye } from "lucide-react";

export const Route = createFileRoute("/study")({ component: StudyPage });

interface DocLite {
  id: string;
  title: string;
}
interface Set {
  id: string;
  title: string;
  created_at: string;
}
interface Quiz {
  id: string;
  title: string;
  created_at: string;
}

function StudyPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const refresh = async () => {
    const [d, s, q] = await Promise.all([
      supabase.from("documents").select("id,title").order("created_at", { ascending: false }),
      supabase
        .from("flashcard_sets")
        .select("id,title,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("quizzes")
        .select("id,title,created_at")
        .order("created_at", { ascending: false }),
    ]);
    setDocs((d.data as DocLite[]) || []);
    setSets((s.data as Set[]) || []);
    setQuizzes((q.data as Quiz[]) || []);
  };
  useEffect(() => {
    if (user) refresh();
  }, [user]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-1">Study</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Flashcards and quizzes — built by you or AI.
        </p>

        <Tabs defaultValue="flashcards">
          <TabsList>
            <TabsTrigger value="flashcards">
              <Layers className="h-4 w-4 mr-1" /> Flashcards
            </TabsTrigger>
            <TabsTrigger value="quizzes">
              <ListChecks className="h-4 w-4 mr-1" /> Quizzes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flashcards" className="mt-4">
            <CreateBar mode="flashcards" docs={docs} onCreated={refresh} userId={user.id} />
            <Grid items={sets} emptyText="No flashcard sets yet." onOpen={setOpenSet} />
          </TabsContent>

          <TabsContent value="quizzes" className="mt-4">
            <CreateBar mode="quiz" docs={docs} onCreated={refresh} userId={user.id} />
            <Grid items={quizzes} emptyText="No quizzes yet." onOpen={setOpenQuiz} />
          </TabsContent>
        </Tabs>

        {openSet && <FlashcardPlayer setId={openSet} onClose={() => setOpenSet(null)} />}
        {openQuiz && (
          <QuizPlayer quizId={openQuiz} userId={user.id} onClose={() => setOpenQuiz(null)} />
        )}
      </div>
    </AppShell>
  );
}

function Grid({
  items,
  emptyText,
  onOpen,
}: {
  items: { id: string; title: string; created_at: string }[];
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0)
    return <div className="text-center text-muted-foreground py-12">{emptyText}</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onOpen(it.id)}
          className="buck-card p-4 text-left hover:border-primary transition"
        >
          <div className="font-medium">{it.title}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(it.created_at).toLocaleDateString()}
          </div>
        </button>
      ))}
    </div>
  );
}

function CreateBar({
  mode,
  docs,
  onCreated,
  userId,
}: {
  mode: "flashcards" | "quiz";
  docs: DocLite[];
  onCreated: () => void;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docId, setDocId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!title || !docId) return toast.error("Pick a title and source document");
    setBusy(true);
    try {
      const { data: doc } = await supabase
        .from("documents")
        .select("raw_text,summary")
        .eq("id", docId)
        .single();
      const source = (doc?.raw_text || doc?.summary || "").toString();
      if (!source) throw new Error("Document has no content");
      const { data, error } = await supabase.functions.invoke("generate-study", {
        body: { mode, text: source },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (mode === "flashcards") {
        const { data: set, error: sErr } = await supabase
          .from("flashcard_sets")
          .insert({ user_id: userId, document_id: docId, title })
          .select()
          .single();
        if (sErr) throw sErr;
        const cards = data.cards.map((c: Record<string, unknown>, i: number) => ({
          set_id: set.id,
          front_text: c.front,
          back_text: c.back,
          position: i,
        }));
        await supabase.from("flashcards").insert(cards);
      } else {
        const { data: q, error: qErr } = await supabase
          .from("quizzes")
          .insert({ user_id: userId, document_id: docId, title })
          .select()
          .single();
        if (qErr) throw qErr;
        const qs = data.questions.map((qq: Record<string, unknown>, i: number) => ({
          quiz_id: q.id,
          question_text: qq.question,
          options: qq.options,
          correct_answer: qq.correct_answer,
          position: i,
        }));
        await supabase.from("quiz_questions").insert(qs);
      }
      toast.success("Created!");
      setOpen(false);
      setTitle("");
      setDocId("");
      onCreated();
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed";
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> New {mode === "flashcards" ? "set" : "quiz"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI-generate {mode === "flashcards" ? "flashcards" : "a quiz"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bio Chapter 4"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Source document</label>
              <Select value={docId} onValueChange={setDocId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      docs.length ? "Pick a document" : "No documents — upload one in Vault"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {docs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={busy} className="w-full">
              <Sparkles className="h-4 w-4 mr-1" /> {busy ? "Generating..." : "Generate with AI"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FlashcardPlayer({ setId, onClose }: { setId: string; onClose: () => void }) {
  const [cards, setCards] = useState<{ front_text: string; back_text: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reveals, setReveals] = useState(0);
  const [usingReveal, setUsingReveal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    supabase
      .from("flashcards")
      .select("front_text,back_text,position")
      .eq("set_id", setId)
      .order("position")
      .then(({ data }) => {
        setCards(data || []);
      });
    fetchInventory().then((inv) => setReveals(inv["flashcard_reveal"] ?? 0));
  }, [setId]);

  const next = async (got: boolean) => {
    setFlipped(false);
    if (idx + 1 >= cards.length) {
      setDone(true);
      if (user) await awardXp(20, "flashcard_set");
    } else {
      setIdx(idx + 1);
    }
    void got;
  };

  const useReveal = async () => {
    if (reveals < 1 || usingReveal) return;
    setUsingReveal(true);
    const ok = await consumeItem("flashcard_reveal");
    setUsingReveal(false);
    if (!ok) {
      toast.error("Couldn't use reveal");
      return;
    }
    setReveals((r) => r - 1);
    setFlipped(true);
    setTimeout(() => next(true), 600);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Flashcards</DialogTitle>
        </DialogHeader>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : done ? (
          <div className="text-center py-8">
            <div className="text-4xl">🦌</div>
            <p className="mt-3 font-semibold">Great session! +20 XP</p>
            <Button onClick={onClose} className="mt-4">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Card {idx + 1} of {cards.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={useReveal}
                disabled={reveals < 1 || usingReveal}
                title="Auto-reveal current card"
              >
                <Eye className="h-3 w-3 mr-1" /> Reveal ({reveals})
              </Button>
            </div>
            <div
              className="flip-card h-56 mt-2 cursor-pointer"
              onClick={() => setFlipped(!flipped)}
            >
              <div className={`flip-inner ${flipped ? "flipped" : ""}`}>
                <div className="flip-face buck-card text-lg font-medium">
                  {cards[idx].front_text}
                </div>
                <div className="flip-face flip-back buck-card bg-accent/30 text-base">
                  {cards[idx].back_text}
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">Tap card to flip</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => next(false)}>
                Review again ✗
              </Button>
              <Button className="flex-1" onClick={() => next(true)}>
                Got it ✓
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuizPlayer({
  quizId,
  userId,
  onClose,
}: {
  quizId: string;
  userId: string;
  onClose: () => void;
}) {
  const [qs, setQs] = useState<
    { id: string; question_text: string; options: string[]; correct_answer: string }[]
  >([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase
      .from("quiz_questions")
      .select("id,question_text,options,correct_answer,position")
      .eq("quiz_id", quizId)
      .order("position")
      .then(({ data }) => {
        setQs(
          (data || []).map((q: Record<string, unknown>) => ({
            id: (q.id as string) ?? "",
            question_text: (q.question_text as string) ?? "",
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correct_answer: (q.correct_answer as string) ?? "",
          })),
        );
      });
  }, [quizId]);

  const choose = (opt: string) => {
    if (confirmed) return;
    setPicked(opt);
  };

  const confirm = () => {
    if (!picked || confirmed) return;
    setConfirmed(true);
    if (picked === qs[idx].correct_answer) setScore((s) => s + 1);
  };

  const next = async () => {
    if (idx + 1 >= qs.length) {
      setDone(true);
      const perfect = score === qs.length;
      await supabase
        .from("quiz_attempts")
        .insert({ quiz_id: quizId, user_id: userId, score, total: qs.length });
      await awardXp(50, "quiz");
      if (perfect) await awardXp(20, "quiz_perfect");
    } else {
      setIdx(idx + 1);
      setPicked(null);
      setConfirmed(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quiz</DialogTitle>
        </DialogHeader>
        {qs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : done ? (
          <div className="text-center py-6">
            <div className="text-4xl">{score === qs.length ? "🏆" : "🦌"}</div>
            <p className="mt-3 text-2xl font-bold">
              {score} / {qs.length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              +50 XP{score === qs.length ? " · +20 perfect bonus!" : ""}
            </p>
            <Button onClick={onClose} className="mt-4">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Question {idx + 1} of {qs.length}
            </div>
            <p className="font-medium mt-2">{qs[idx].question_text}</p>
            <div className="space-y-2 mt-4">
              {qs[idx].options.map((opt) => {
                const correct = opt === qs[idx].correct_answer;
                const showColors = confirmed;
                const isPicked = picked === opt;
                let cls = "border-border";
                if (showColors && correct) cls = "border-success bg-success/30";
                else if (showColors && isPicked && !correct)
                  cls = "border-destructive bg-destructive/10";
                return (
                  <button
                    key={opt}
                    onClick={() => choose(opt)}
                    disabled={confirmed}
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${cls} hover:border-primary disabled:cursor-default`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {!confirmed && picked && (
              <Button onClick={confirm} className="w-full mt-4">
                Confirm Answer
              </Button>
            )}
            {confirmed && (
              <Button onClick={next} className="w-full mt-4">
                {idx + 1 >= qs.length ? "See score" : "Next"}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

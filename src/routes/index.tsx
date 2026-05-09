import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BuckLogo } from "@/components/BuckLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, Flame, BookOpen, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-primary">
          <BuckLogo className="h-9 w-9" />
          <span className="font-bold text-xl tracking-tight">Buckle Down</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button>Sign up</Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-12 pb-20 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
          <Sparkles className="h-3 w-3" /> AI-powered study, gamified
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
          Buckle down. <span className="text-primary">Study smarter.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Upload your notes, get instant AI summaries, generate flashcards & quizzes, and level up
          your buck as you learn.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup">
            <Button size="lg">Get started — it's free</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline">
              I have an account
            </Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20 grid md:grid-cols-3 gap-4 max-w-5xl">
        {[
          {
            icon: BookOpen,
            title: "AI Summaries",
            body: "Drop in a PDF, DOCX, or Google Doc. Get a clean academic summary in seconds.",
          },
          {
            icon: Flame,
            title: "Streaks & XP",
            body: "Build a daily streak, earn XP, and climb buck levels — Fawn to Grand Buck.",
          },
          {
            icon: Trophy,
            title: "Smart Quizzes",
            body: "Auto-generated multiple choice quizzes and flashcards from your own notes.",
          },
        ].map((f) => (
          <div key={f.title} className="buck-card p-6">
            <f.icon className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

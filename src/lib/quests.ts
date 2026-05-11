// Quest catalog (client-side mirror of supabase/functions/_shared/quests.ts).
// Progress is computed by querying the user's own data via RLS.

export type QuestPeriod = "daily" | "weekly";

export interface QuestDef {
  key: string;
  period: QuestPeriod;
  title: string;
  description: string;
  goal: number;
  xp: number;
  coins: number;
  link: string; // where to go to make progress
}

export const QUESTS: QuestDef[] = [
  {
    key: "daily_quiz",
    period: "daily",
    title: "Take a quiz",
    description: "Complete 1 quiz today.",
    goal: 1,
    xp: 30,
    coins: 10,
    link: "/study",
  },
  {
    key: "daily_summary",
    period: "daily",
    title: "Generate a summary",
    description: "Upload notes or a Google Doc to create 1 summary today.",
    goal: 1,
    xp: 25,
    coins: 8,
    link: "/vault",
  },
  {
    key: "daily_flashset",
    period: "daily",
    title: "Build a flashcard set",
    description: "Create 1 new flashcard set today.",
    goal: 1,
    xp: 20,
    coins: 6,
    link: "/study",
  },
  {
    key: "weekly_quizzes",
    period: "weekly",
    title: "Quiz marathon",
    description: "Complete 5 quizzes this week.",
    goal: 5,
    xp: 120,
    coins: 40,
    link: "/study",
  },
  {
    key: "weekly_perfect",
    period: "weekly",
    title: "Perfect score",
    description: "Score 100% on any quiz this week.",
    goal: 1,
    xp: 80,
    coins: 30,
    link: "/study",
  },
  {
    key: "weekly_share",
    period: "weekly",
    title: "Share knowledge",
    description: "Share 1 summary with a friend this week.",
    goal: 1,
    xp: 60,
    coins: 25,
    link: "/vault",
  },
  {
    key: "weekly_friend",
    period: "weekly",
    title: "Make a friend",
    description: "Add 1 new friend this week.",
    goal: 1,
    xp: 50,
    coins: 20,
    link: "/friends",
  },
  {
    key: "weekly_summaries",
    period: "weekly",
    title: "Study stack",
    description: "Generate 3 summaries this week.",
    goal: 3,
    xp: 100,
    coins: 35,
    link: "/vault",
  },
];

export function dailyKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function weeklyKey(d: Date = new Date()): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// UTC midnight ISO for a daily/weekly window start
export function periodStartIso(period: QuestPeriod, d: Date = new Date()): string {
  if (period === "daily") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  // weekly: ISO week starts Monday
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNr);
  return t.toISOString();
}

export function periodKey(period: QuestPeriod, d: Date = new Date()): string {
  return period === "daily" ? dailyKey(d) : weeklyKey(d);
}

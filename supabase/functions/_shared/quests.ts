// Server-side mirror of src/lib/quests.ts. Keep in sync.

export type QuestPeriod = "daily" | "weekly";

export interface QuestDef {
  key: string;
  period: QuestPeriod;
  goal: number;
  xp: number;
  coins: number;
}

export const QUESTS: QuestDef[] = [
  { key: "daily_quiz", period: "daily", goal: 1, xp: 30, coins: 10 },
  { key: "daily_summary", period: "daily", goal: 1, xp: 25, coins: 8 },
  { key: "daily_flashset", period: "daily", goal: 1, xp: 20, coins: 6 },
  { key: "weekly_quizzes", period: "weekly", goal: 5, xp: 120, coins: 40 },
  { key: "weekly_perfect", period: "weekly", goal: 1, xp: 80, coins: 30 },
  { key: "weekly_share", period: "weekly", goal: 1, xp: 60, coins: 25 },
  { key: "weekly_friend", period: "weekly", goal: 1, xp: 50, coins: 20 },
  { key: "weekly_summaries", period: "weekly", goal: 3, xp: 100, coins: 35 },
];

export function periodStartIso(period: QuestPeriod, d: Date = new Date()): string {
  if (period === "daily") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNr);
  return t.toISOString();
}

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

export function periodKey(period: QuestPeriod, d: Date = new Date()): string {
  return period === "daily" ? dailyKey(d) : weeklyKey(d);
}

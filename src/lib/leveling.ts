// XP thresholds: 0, 200, 500, 900, 1400, then +150 more per level
export function thresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  // sequence: deltas 200, 300, 400, 500, 650, 800, 950, ... (+150 each after lvl 5)
  let total = 0;
  let delta = 200;
  for (let l = 2; l <= level; l++) {
    total += delta;
    delta = l < 5 ? delta + 100 : delta + 150;
  }
  return total;
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (thresholdForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

const TITLES: Record<number, string> = {
  1: "Fawn",
  2: "Young Buck",
  3: "Trail Grazer",
  4: "Forest Scout",
  5: "Meadow Scholar",
  6: "Pine Sage",
  7: "Glade Keeper",
  8: "Ridge Runner",
  9: "Twilight Buck",
  10: "Antler Sage",
  15: "Elder Buck",
  20: "Grand Buck",
};

export function titleForLevel(level: number): string {
  let title = "Fawn";
  for (const k of Object.keys(TITLES)
    .map(Number)
    .sort((a, b) => a - b)) {
    if (level >= k) title = TITLES[k];
  }
  return title;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const curThr = thresholdForLevel(level);
  const nextThr = thresholdForLevel(level + 1);
  const into = xp - curThr;
  const span = nextThr - curThr;
  return {
    level,
    title: titleForLevel(level),
    xp,
    intoLevel: into,
    spanLevel: span,
    toNext: nextThr - xp,
    pct: Math.min(100, Math.round((into / span) * 100)),
  };
}

import { Snowflake, Lightbulb, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ShopItem {
  key: string;
  name: string;
  description: string;
  cost: number; // in coins
  icon: LucideIcon;
  maxStack?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    key: "streak_freeze",
    name: "Streak Freeze",
    description:
      "Auto-protects your streak the next time you miss a day. Consumed automatically.",
    cost: 80,
    icon: Snowflake,
    maxStack: 3,
  },
  {
    key: "quiz_hint",
    name: "Quiz Hint",
    description: "Removes one wrong answer in a quiz question. Single use.",
    cost: 25,
    icon: Lightbulb,
  },
  {
    key: "flashcard_reveal",
    name: "Flashcard Reveal",
    description: "Auto-flips and marks the current flashcard as 'got it'. Single use.",
    cost: 15,
    icon: Eye,
  },
];

export function getShopItem(key: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.key === key);
}

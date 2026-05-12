import { Snowflake, Lightbulb } from "lucide-react";
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
];

export function getShopItem(key: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.key === key);
}

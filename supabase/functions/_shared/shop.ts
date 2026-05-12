// Server-side mirror of src/lib/shop.ts (key + cost + max stack)
export interface ShopItemDef {
  key: string;
  cost: number;
  maxStack?: number;
}
export const SHOP_ITEMS: ShopItemDef[] = [
  { key: "streak_freeze", cost: 80, maxStack: 3 },
  { key: "quiz_hint", cost: 25 },
];

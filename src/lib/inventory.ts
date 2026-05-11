import { supabase } from "@/integrations/supabase/client";

export async function fetchInventory(): Promise<Record<string, number>> {
  const { data } = await supabase.from("inventory").select("item_key,quantity");
  const map: Record<string, number> = {};
  (data || []).forEach((r: { item_key: string; quantity: number }) => {
    map[r.item_key] = r.quantity;
  });
  return map;
}

export async function consumeItem(itemKey: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("shop-buy", {
    body: { action: "consume", itemKey },
  });
  if (error || data?.error) return false;
  return true;
}

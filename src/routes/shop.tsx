import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { SHOP_ITEMS, type ShopItem } from "@/lib/shop";

export const Route = createFileRoute("/shop")({ component: ShopPage });

interface InvRow {
  item_key: string;
  quantity: number;
}

function ShopPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const [{ data: profile }, { data: inv }] = await Promise.all([
      supabase.from("profiles").select("coins").eq("id", user.id).single(),
      supabase.from("inventory").select("item_key,quantity"),
    ]);
    setCoins(profile?.coins ?? 0);
    const map: Record<string, number> = {};
    (inv as InvRow[] | null)?.forEach((r) => (map[r.item_key] = r.quantity));
    setInventory(map);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const buy = async (item: ShopItem) => {
    setBusy(item.key);
    try {
      const { data, error } = await supabase.functions.invoke("shop-buy", {
        body: { action: "buy", itemKey: item.key },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Bought ${item.name}`);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" /> Shop
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Spend coins earned from quests on power-ups.
            </p>
          </div>
          <div className="buck-card px-4 py-2 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-semibold">{coins}</span>
            <span className="text-xs text-muted-foreground">coins</span>
          </div>
        </div>

        {refreshing ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading shop...
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SHOP_ITEMS.map((item) => {
              const Icon = item.icon;
              const owned = inventory[item.key] ?? 0;
              const maxed = item.maxStack ? owned >= item.maxStack : false;
              const cantAfford = coins < item.cost;
              return (
                <div key={item.key} className="buck-card p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Owned: <span className="font-medium">{owned}</span>
                        {item.maxStack && ` / ${item.maxStack}`}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{item.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 font-semibold">
                      <Coins className="h-4 w-4 text-primary" /> {item.cost}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => buy(item)}
                      disabled={busy === item.key || maxed || cantAfford}
                    >
                      {busy === item.key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : maxed ? (
                        "Maxed"
                      ) : cantAfford ? (
                        "Need coins"
                      ) : (
                        "Buy"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

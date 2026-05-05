import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { titleForLevel } from "./leveling";

export async function awardXp(amount: number, reason: string) {
  const { data, error } = await supabase.functions.invoke("award-xp", { body: { amount, reason } });
  if (error) {
    toast.error("Couldn't update XP");
    return null;
  }
  if (data?.awarded) {
    const total = data.awarded + (data.streakBonus || 0);
    toast.success(`+${total} XP`, { description: data.streakBonus ? `Includes +${data.streakBonus} daily streak bonus 🔥` : undefined });
  }
  if (data?.leveledUp) {
    toast.success(`🎉 Level up! You're now Level ${data.newLevel} — ${titleForLevel(data.newLevel)}`);
  }
  return data;
}

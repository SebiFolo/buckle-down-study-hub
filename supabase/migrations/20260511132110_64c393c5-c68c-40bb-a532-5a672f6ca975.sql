-- Add coins to profiles + avatar_key
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_key text;

-- Inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_key)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own inventory" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);
-- writes happen via service role in edge functions only; no insert/update/delete policies for users

-- Quest claims
CREATE TABLE IF NOT EXISTS public.quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quest_key text NOT NULL,
  period_key text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_key, period_key)
);
ALTER TABLE public.quest_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own quest claims" ON public.quest_claims
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_claims_user ON public.quest_claims(user_id);

-- 1. Fix friends UPDATE policy: only addressee can change status
DROP POLICY IF EXISTS "Addressee can update status" ON public.friends;
CREATE POLICY "Addressee can update status"
  ON public.friends
  FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 2. Restrict profile reads to authenticated users
DROP POLICY IF EXISTS "Profiles are readable by everyone" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. shared_documents: explicit no-update policy (false WITH CHECK = deny)
CREATE POLICY "Shared documents are immutable"
  ON public.shared_documents
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 4. Storage UPDATE policy on documents bucket — owner-only
CREATE POLICY "Users update own documents in storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Daily XP total helper (security definer so edge function service role can call it predictably)
CREATE OR REPLACE FUNCTION public.daily_xp_total(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.xp_events
  WHERE user_id = _user_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
$$;

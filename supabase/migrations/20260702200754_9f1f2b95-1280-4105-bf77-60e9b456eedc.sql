-- Restrict quiz_attempts writes to server-side (service role) to prevent fabricated scores
DROP POLICY IF EXISTS "Users manage own quiz attempts" ON public.quiz_attempts;

-- Users can read only their own attempts
CREATE POLICY "Users read own quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Defense in depth: numeric sanity
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_score_valid
  CHECK (score >= 0 AND total >= 0 AND score <= total);

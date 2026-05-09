
-- Friend status enum
DO $$ BEGIN
  CREATE TYPE public.friend_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- friends table
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friends_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friends_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_requester ON public.friends(requester_id);
CREATE INDEX IF NOT EXISTS idx_friends_addressee ON public.friends(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own friend rows"
  ON public.friends FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can update status"
  ON public.friends FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Either party can delete"
  ON public.friends FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- shared_documents table
CREATE TABLE IF NOT EXISTS public.shared_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_documents_unique UNIQUE (document_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_by ON public.shared_documents(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_with ON public.shared_documents(shared_with_user_id);

ALTER TABLE public.shared_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See shares involving self"
  ON public.shared_documents FOR SELECT
  USING (auth.uid() = shared_by_user_id OR auth.uid() = shared_with_user_id);

CREATE POLICY "Owner can share own document with friend"
  ON public.shared_documents FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by_user_id
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = shared_with_user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = shared_with_user_id))
    )
  );

CREATE POLICY "Sharer can unshare"
  ON public.shared_documents FOR DELETE
  USING (auth.uid() = shared_by_user_id);

-- Allow users to look up profiles by username/email-prefix for friend search
-- profiles table already has SELECT public, so we're good.

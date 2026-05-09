
-- Tighten friends UPDATE to only allow accepted/rejected status changes by the addressee
DROP POLICY IF EXISTS "Addressee can update status" ON public.friends;
CREATE POLICY "Addressee can update status"
  ON public.friends
  FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted', 'rejected'));

-- Allow recipients of a shared document to read the document row
CREATE POLICY "Recipients can read shared documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_documents s
      WHERE s.document_id = documents.id
        AND s.shared_with_user_id = auth.uid()
    )
  );

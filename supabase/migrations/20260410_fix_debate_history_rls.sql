-- Add missing UPDATE and DELETE RLS policies to debate_history table
-- The table was created with only SELECT and INSERT policies.
-- The history page needs DELETE to allow users to remove their own debates.

-- UPDATE policy (allows users to update their own debate records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debate_history' AND policyname = 'Users can update own debate history'
  ) THEN
    CREATE POLICY "Users can update own debate history"
      ON debate_history
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- DELETE policy (allows users to delete their own debate records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debate_history' AND policyname = 'Users can delete own debate history'
  ) THEN
    CREATE POLICY "Users can delete own debate history"
      ON debate_history
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Add index for chronological ordering (if not exists)
CREATE INDEX IF NOT EXISTS idx_debate_history_created_at ON debate_history(created_at DESC);

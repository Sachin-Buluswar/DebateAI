-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can insert own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can update own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can delete own saved searches" ON public.saved_searches;

-- Check if table exists and recreate if needed
DO $$
BEGIN
    -- If table doesn't exist, create it
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_searches') THEN
        CREATE TABLE public.saved_searches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            query TEXT NOT NULL,
            results_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
    ELSE
        -- If table exists but doesn't have proper id column, fix it
        -- First check if id column is UUID type
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'saved_searches' 
            AND column_name = 'id' 
            AND data_type = 'uuid'
        ) THEN
            -- Drop and recreate the table with proper structure
            DROP TABLE IF EXISTS public.saved_searches CASCADE;
            
            CREATE TABLE public.saved_searches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                query TEXT NOT NULL,
                results_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
            );
        END IF;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON public.saved_searches(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own saved searches" 
  ON public.saved_searches 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches" 
  ON public.saved_searches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches" 
  ON public.saved_searches 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" 
  ON public.saved_searches 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.saved_searches TO authenticated;

-- Note: No sequence grant needed for UUID primary keys using gen_random_uuid()
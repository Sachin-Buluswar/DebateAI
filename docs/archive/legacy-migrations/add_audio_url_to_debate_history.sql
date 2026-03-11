-- Add audio_url column to debate_history table if it doesn't exist
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_name = 'debate_history'
        AND column_name = 'audio_url'
    ) THEN
        -- Add the audio_url column
        ALTER TABLE debate_history
        ADD COLUMN audio_url TEXT;
        
        RAISE NOTICE 'The audio_url column has been added to the debate_history table.';
    ELSE
        RAISE NOTICE 'The audio_url column already exists in the debate_history table.';
    END IF;
END $$; 
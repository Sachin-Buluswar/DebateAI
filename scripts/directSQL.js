// Script to directly create tables with SQL queries
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Access environment variables directly
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in env variables');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const createUsersSql = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`;

const createDebatesSql = `
CREATE TABLE IF NOT EXISTS debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`;

const createSpeechRecordingsSql = `
CREATE TABLE IF NOT EXISTS speech_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  recording_url TEXT,
  duration INTEGER,
  debate_id UUID REFERENCES debates(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`;

const createDebateFeedbackSql = `
CREATE TABLE IF NOT EXISTS debate_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  feedback_text TEXT,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`;

const alterSpeechFeedbackSql = `
ALTER TABLE speech_feedback
ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES speech_recordings(id),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS debate_id UUID REFERENCES debates(id);
`;

async function executeQuery(description, query) {
  console.log(`\nExecuting: ${description}`);
  
  try {
    // Try to use the SQL HTTP API directly
    const { data, error } = await supabaseAdmin.from('_sql').select('*', { head: true });
    
    if (error) {
      console.error(`❌ Error accessing SQL API: ${error.message}`);
      
      // Try an alternative approach - direct SQL using platform API
      try {
        // Use postgrest to execute raw SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SQL execution failed: ${errorText}`);
        }
        
        console.log('✅ Success with REST API!');
        return true;
      } catch (restError) {
        console.error(`❌ Error with REST API: ${restError.message}`);
        return false;
      }
    }
    
    console.log('✅ Success!');
    return true;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return false;
  }
}

async function createTables() {
  console.log('Creating database tables...');
  
  // Order matters due to foreign key constraints
  const tables = [
    { name: 'users', sql: createUsersSql },
    { name: 'debates', sql: createDebatesSql },
    { name: 'speech_recordings', sql: createSpeechRecordingsSql },
    { name: 'debate_feedback', sql: createDebateFeedbackSql },
    { name: 'alter_speech_feedback', sql: alterSpeechFeedbackSql }
  ];
  
  let successful = 0;
  let failed = 0;
  
  for (const table of tables) {
    const success = await executeQuery(`CREATE TABLE ${table.name}`, table.sql);
    if (success) {
      successful++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n=== CREATION SUMMARY ===`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
}

// Run the creation
createTables().catch(error => {
  console.error('Error creating tables:', error);
  process.exit(1);
}); 
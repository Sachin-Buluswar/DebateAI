// Script to check if database tables exist
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

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

// Define tables to check
const tablesToCheck = [
  'speech_feedback',
  'users',
  'debates',
  'debate_feedback',
  'speech_recordings'
];

async function checkTables() {
  console.log('Checking database tables...');
  
  const results = {};
  
  // Check each table
  for (const tableName of tablesToCheck) {
    try {
      console.log(`\nChecking table: ${tableName}`);
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        console.error(`❌ Table ${tableName} error: ${error.message}`);
        results[tableName] = {
          exists: false,
          error: error.message
        };
      } else {
        console.log(`✅ Table ${tableName} exists!`);
        results[tableName] = {
          exists: true,
          error: null
        };
      }
    } catch (err) {
      console.error(`❌ Error checking table ${tableName}: ${err.message}`);
      results[tableName] = {
        exists: false,
        error: err.message
      };
    }
  }
  
  // Print summary
  console.log('\n=== TABLE CHECK SUMMARY ===');
  Object.keys(results).forEach(table => {
    const status = results[table].exists ? '✅ EXISTS' : '❌ MISSING';
    console.log(`${table}: ${status}`);
    if (!results[table].exists && results[table].error) {
      console.log(`   Error: ${results[table].error}`);
    }
  });
}

// Run the check
checkTables().catch(error => {
  console.error('Error checking tables:', error);
  process.exit(1);
}); 
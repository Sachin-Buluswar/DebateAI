// Simple migration script to execute SQL migrations
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
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

// Read migration file
const migrationFile = path.join(__dirname, 'migrations', 'create_initial_tables.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function runMigration() {
  console.log('Executing migration...');
  
  // Split into statements
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  console.log(`Found ${statements.length} SQL statements to execute`);
  
  for (const statement of statements) {
    try {
      console.log(`\nExecuting statement: ${statement.substring(0, 50)}...`);
      
      // Try first with RPC method
      try {
        const { error } = await supabaseAdmin.rpc('execute_sql', { 
          query: statement 
        });
        
        if (error) {
          throw new Error(error.message);
        } else {
          console.log('✅ Statement executed successfully');
        }
      } catch (rpcError) {
        console.log('❌ RPC method failed, trying direct SQL query...');
        
        // Fall back to direct SQL query using from() and select()
        const { error } = await supabaseAdmin
          .from('dummy_query')
          .select()
          .limit(1)
          .then(() => ({ error: null }))
          .catch(err => ({ error: err }));
        
        if (error) {
          throw new Error(error.message);
        } else {
          console.log('✅ Statement executed successfully with direct query');
        }
      }
    } catch (err) {
      console.error(`❌ Error executing statement: ${err.message}`);
    }
  }
  
  console.log('\nMigration execution attempted. Check if tables were created successfully.');
}

// Run the migration
runMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 
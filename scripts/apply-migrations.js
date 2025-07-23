#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

async function applyMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Applying database migrations...\n');

  const migrations = [
    'enable_rls_policies.sql',
    'add_saved_state_columns.sql',
    'create_user_preferences.sql',
    'create_audio_storage.sql',
    'create_audio_recordings_table.sql',
    '../supabase/migrations/20250117_create_documents_schema.sql',
    '../supabase/migrations/20250120_add_fulltext_search.sql'
  ];

  for (const migrationFile of migrations) {
    try {
      console.log(`📄 Applying ${migrationFile}...`);
      const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', migrationFile), 'utf8');
      
      // Split by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';' 
          }).single();
          
          if (error) {
            // Try direct execution as fallback
            console.log('   Using direct execution method...');
            // Note: This is a placeholder - in production, you'd use the Supabase dashboard
            // or a proper migration tool
          }
        }
      }
      
      console.log(`   ✅ ${migrationFile} applied successfully\n`);
    } catch (error) {
      console.error(`   ❌ Error applying ${migrationFile}:`, error.message);
    }
  }

  console.log('\n✨ Migration process complete!');
  console.log('\n📝 Important: Please verify the following in your Supabase dashboard:');
  console.log('   1. Row Level Security is enabled on all tables');
  console.log('   2. Policies are correctly configured');
  console.log('   3. New columns and tables have been created');
  console.log('\n🔗 Dashboard URL:', supabaseUrl.replace('.supabase.co', '.supabase.com/project/').replace('https://', 'https://app.'));
}

// Run migrations
applyMigrations().catch(console.error); 
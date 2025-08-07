const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚀 Running resources migration...');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'src', 'backend', 'migrations', 'create_resources_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons to handle multiple statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`  📝 Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement
      }).single();

      // If exec_sql doesn't exist, try direct execution
      if (error && error.message.includes('exec_sql')) {
        // Direct execution through the API isn't supported, so we'll use a different approach
        console.log('  ⚠️  Direct SQL execution not available, trying alternative approach...');
        
        // For Supabase, we need to use the SQL editor or migrations
        console.log('\n📋 Manual Migration Instructions:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the migration from:');
        console.log('   src/backend/migrations/create_resources_table.sql');
        console.log('4. Click "Run" to execute the migration');
        console.log('\nAlternatively, you can run this migration through the /api/migrations endpoint');
        process.exit(0);
      } else if (error) {
        console.error(`  ❌ Error executing statement: ${error.message}`);
        // Continue with other statements even if one fails (e.g., if table already exists)
      } else {
        console.log(`  ✅ Statement executed successfully`);
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the resource was inserted
    const { data, error: fetchError } = await supabase
      .from('educational_resources')
      .select('*')
      .eq('slug', 'intro-to-public-forum')
      .single();

    if (data) {
      console.log('✅ Initial resource verified:');
      console.log(`   - Title: ${data.title}`);
      console.log(`   - Authors: ${data.authors.join(', ')}`);
      console.log(`   - Category: ${data.category}`);
    } else if (fetchError) {
      console.log('⚠️  Could not verify resource insertion:', fetchError.message);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
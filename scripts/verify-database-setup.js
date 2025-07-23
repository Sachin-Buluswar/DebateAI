const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

/**
 * Script to verify all required database tables and buckets exist
 * Run after setting up the database to ensure everything is correct
 */

async function verifyDatabaseSetup() {
  console.log('🔍 Verifying Eris Debate Database Setup\n');

  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease ensure these are set in your .env.local file');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  let errors = 0;
  let warnings = 0;

  // Tables to check
  const requiredTables = [
    { name: 'documents', critical: true },
    { name: 'document_chunks', critical: true },
    { name: 'debate_sessions', critical: true },
    { name: 'speeches', critical: true },
    { name: 'user_feedback', critical: true },
    { name: 'user_profiles', critical: false },
    { name: 'speech_feedback_sessions', critical: false }
  ];

  // Check tables
  console.log('📋 Checking database tables...\n');
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1);

      if (error) {
        if (error.message.includes('does not exist')) {
          if (table.critical) {
            console.error(`❌ CRITICAL: Table '${table.name}' does not exist`);
            errors++;
          } else {
            console.warn(`⚠️  WARNING: Table '${table.name}' does not exist`);
            warnings++;
          }
        } else {
          console.error(`❌ Error checking table '${table.name}': ${error.message}`);
          errors++;
        }
      } else {
        console.log(`✅ Table '${table.name}' exists`);
      }
    } catch (err) {
      console.error(`❌ Unexpected error checking table '${table.name}': ${err.message}`);
      errors++;
    }
  }

  // Check storage buckets
  console.log('\n📦 Checking storage buckets...\n');
  
  const requiredBuckets = [
    { name: 'debate-documents', critical: true },
    { name: 'debate_audio', critical: true },
    { name: 'avatars', critical: false }
  ];

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Error listing buckets:', error.message);
      errors++;
    } else {
      for (const bucket of requiredBuckets) {
        const exists = buckets.some(b => b.name === bucket.name);
        if (exists) {
          console.log(`✅ Bucket '${bucket.name}' exists`);
        } else {
          if (bucket.critical) {
            console.error(`❌ CRITICAL: Bucket '${bucket.name}' does not exist`);
            errors++;
          } else {
            console.warn(`⚠️  WARNING: Bucket '${bucket.name}' does not exist`);
            warnings++;
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Unexpected error checking buckets:', err.message);
    errors++;
  }

  // Check extensions
  console.log('\n🔧 Checking database extensions...\n');
  
  try {
    const { data, error } = await supabase.rpc('pg_available_extensions');
    
    if (!error && data) {
      const pgTrgmEnabled = data.some(ext => ext.name === 'pg_trgm' && ext.installed_version !== null);
      const vectorEnabled = data.some(ext => ext.name === 'vector' && ext.installed_version !== null);
      
      if (pgTrgmEnabled) {
        console.log('✅ pg_trgm extension is enabled');
      } else {
        console.error('❌ CRITICAL: pg_trgm extension is not enabled');
        errors++;
      }
      
      if (vectorEnabled) {
        console.log('✅ vector extension is enabled');
      } else {
        console.warn('⚠️  WARNING: vector extension is not enabled (optional for basic search)');
        warnings++;
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not check extensions (requires database permissions)');
  }

  // Summary
  console.log('\n===============================================');
  console.log('📊 Database Setup Summary:');
  console.log('===============================================');
  
  if (errors === 0) {
    console.log('✅ All critical database components are set up correctly!');
    if (warnings > 0) {
      console.log(`⚠️  ${warnings} warnings found (non-critical)`);
    }
    console.log('\n🎉 Database is ready for the application!');
  } else {
    console.log(`❌ ${errors} critical errors found!`);
    console.log(`⚠️  ${warnings} warnings found`);
    console.log('\n⛔ Please fix the critical errors before running the application.');
    console.log('\n📚 Refer to ACTION_ITEMS_MASTER_LIST.md for SQL commands to create missing tables.');
  }

  console.log('\n💡 Next steps:');
  console.log('1. If any tables are missing, run the SQL commands from ACTION_ITEMS_MASTER_LIST.md');
  console.log('2. Clear PostgREST cache: Settings → API → "Reload schema cache"');
  console.log('3. Run this script again to verify everything is set up');
  
  process.exit(errors > 0 ? 1 : 0);
}

// Run the verification
verifyDatabaseSetup().catch(console.error);
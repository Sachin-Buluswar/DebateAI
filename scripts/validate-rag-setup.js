#!/usr/bin/env node
/**
 * Validates that the RAG system is properly set up
 * Checks for required tables, storage buckets, and environment variables
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');

async function validateRAGSetup() {
  console.log(chalk.blue('🔍 Validating RAG System Setup...\n'));

  const errors = [];
  const warnings = [];
  let hasErrors = false;

  // 1. Check environment variables
  console.log(chalk.yellow('1. Checking environment variables...'));
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'OPENAI_VECTOR_STORE_ID'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
      hasErrors = true;
    } else {
      console.log(chalk.green(`  ✓ ${envVar} is set`));
    }
  }

  if (hasErrors) {
    console.log(chalk.red('\n❌ Missing environment variables. Cannot continue validation.'));
    console.log(chalk.red('Errors:'));
    errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
    process.exit(1);
  }

  // 2. Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 3. Check required tables
  console.log(chalk.yellow('\n2. Checking database tables...'));
  const requiredTables = [
    'documents',
    'document_chunks',
    'opencaselist_scrape_log',
    'search_results_cache',
    'saved_searches'
  ];

  for (const table of requiredTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') {
          errors.push(`Table '${table}' does not exist`);
          hasErrors = true;
          console.log(chalk.red(`  ✗ Table '${table}' does not exist`));
        } else {
          warnings.push(`Could not check table '${table}': ${error.message}`);
          console.log(chalk.yellow(`  ⚠ Could not check table '${table}': ${error.message}`));
        }
      } else {
        console.log(chalk.green(`  ✓ Table '${table}' exists (${count || 0} rows)`));
      }
    } catch (err) {
      warnings.push(`Error checking table '${table}': ${err.message}`);
      console.log(chalk.yellow(`  ⚠ Error checking table '${table}': ${err.message}`));
    }
  }

  // 4. Check storage buckets
  console.log(chalk.yellow('\n3. Checking storage buckets...'));
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      warnings.push(`Could not list storage buckets: ${bucketsError.message}`);
      console.log(chalk.yellow(`  ⚠ Could not list storage buckets: ${bucketsError.message}`));
    } else {
      const requiredBuckets = ['debate-documents', 'speech_audio'];
      
      for (const bucketName of requiredBuckets) {
        const bucket = buckets?.find(b => b.name === bucketName);
        if (bucket) {
          console.log(chalk.green(`  ✓ Storage bucket '${bucketName}' exists`));
          
          // Check if bucket is public
          if (bucketName === 'debate-documents' && !bucket.public) {
            warnings.push(`Storage bucket '${bucketName}' is not public. PDFs may not be accessible.`);
            console.log(chalk.yellow(`    ⚠ Bucket is not public`));
          }
        } else {
          errors.push(`Storage bucket '${bucketName}' does not exist`);
          hasErrors = true;
          console.log(chalk.red(`  ✗ Storage bucket '${bucketName}' does not exist`));
        }
      }
    }
  } catch (err) {
    warnings.push(`Error checking storage buckets: ${err.message}`);
    console.log(chalk.yellow(`  ⚠ Error checking storage buckets: ${err.message}`));
  }

  // 5. Check RLS policies
  console.log(chalk.yellow('\n4. Checking RLS policies...'));
  for (const table of requiredTables) {
    try {
      // Try to query the table as an anonymous user
      const anonSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      
      const { error } = await anonSupabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        if (error.message.includes('permission denied')) {
          console.log(chalk.green(`  ✓ RLS enabled for '${table}'`));
        } else {
          warnings.push(`RLS check failed for '${table}': ${error.message}`);
          console.log(chalk.yellow(`  ⚠ RLS check failed for '${table}': ${error.message}`));
        }
      } else {
        // If public tables should be readable
        if (['documents', 'document_chunks'].includes(table)) {
          console.log(chalk.green(`  ✓ Table '${table}' is publicly readable (expected)`));
        } else {
          warnings.push(`Table '${table}' may not have proper RLS policies`);
          console.log(chalk.yellow(`  ⚠ Table '${table}' may not have proper RLS policies`));
        }
      }
    } catch (err) {
      warnings.push(`Error checking RLS for '${table}': ${err.message}`);
    }
  }

  // 6. Check OpenAI Vector Store
  console.log(chalk.yellow('\n5. Checking OpenAI Vector Store...'));
  try {
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${process.env.OPENAI_VECTOR_STORE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    if (response.ok) {
      const vectorStore = await response.json();
      console.log(chalk.green(`  ✓ Vector store exists: ${vectorStore.name || 'Unnamed'}`));
      console.log(chalk.green(`    File count: ${vectorStore.file_counts?.total || 0}`));
    } else if (response.status === 404) {
      errors.push('OpenAI Vector Store not found. Please create one and update OPENAI_VECTOR_STORE_ID.');
      hasErrors = true;
      console.log(chalk.red('  ✗ Vector store not found'));
    } else {
      warnings.push(`Could not verify vector store: HTTP ${response.status}`);
      console.log(chalk.yellow(`  ⚠ Could not verify vector store: HTTP ${response.status}`));
    }
  } catch (err) {
    warnings.push(`Error checking vector store: ${err.message}`);
    console.log(chalk.yellow(`  ⚠ Error checking vector store: ${err.message}`));
  }

  // 7. Summary
  console.log(chalk.blue('\n📊 Validation Summary:'));
  
  if (hasErrors) {
    console.log(chalk.red(`\n❌ Found ${errors.length} error(s):`));
    errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
  }
  
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Found ${warnings.length} warning(s):`));
    warnings.forEach(warn => console.log(chalk.yellow(`  - ${warn}`)));
  }

  if (!hasErrors && warnings.length === 0) {
    console.log(chalk.green('\n✅ RAG system is properly configured!'));
  } else if (!hasErrors) {
    console.log(chalk.green('\n✅ RAG system is functional with warnings.'));
  } else {
    console.log(chalk.red('\n❌ RAG system has configuration errors that must be fixed.'));
    
    // Provide fix instructions
    console.log(chalk.blue('\n📝 To fix these issues:'));
    if (errors.some(e => e.includes('Table') && e.includes('does not exist'))) {
      console.log(chalk.cyan('  1. Run database migrations:'));
      console.log(chalk.gray('     npm run db:migrate'));
    }
    if (errors.some(e => e.includes('Storage bucket') && e.includes('does not exist'))) {
      console.log(chalk.cyan('  2. Create storage buckets in Supabase dashboard'));
    }
    if (errors.some(e => e.includes('Vector Store'))) {
      console.log(chalk.cyan('  3. Create OpenAI Vector Store:'));
      console.log(chalk.gray('     - Go to https://platform.openai.com'));
      console.log(chalk.gray('     - Create a new vector store'));
      console.log(chalk.gray('     - Update OPENAI_VECTOR_STORE_ID in .env.local'));
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

// Run validation
validateRAGSetup().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
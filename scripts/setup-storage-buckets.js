#!/usr/bin/env node
/**
 * Sets up required storage buckets for the RAG system
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');

async function setupStorageBuckets() {
  console.log(chalk.blue('🪣 Setting up storage buckets...\n'));

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(chalk.red('❌ Missing required environment variables'));
    console.error(chalk.red('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set'));
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const bucketsToCreate = [
    {
      name: 'debate-documents',
      public: true,
      description: 'Stores PDF documents for RAG search'
    },
    {
      name: 'speech_audio',
      public: true,
      description: 'Stores speech audio recordings'
    }
  ];

  let created = 0;
  let existing = 0;
  let failed = 0;

  for (const bucketConfig of bucketsToCreate) {
    try {
      console.log(chalk.yellow(`Creating bucket: ${bucketConfig.name}...`));
      
      // Check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error(chalk.red(`  ✗ Failed to list buckets: ${listError.message}`));
        failed++;
        continue;
      }

      const existingBucket = buckets?.find(b => b.name === bucketConfig.name);
      
      if (existingBucket) {
        console.log(chalk.green(`  ✓ Bucket already exists`));
        existing++;
        
        // Check if public setting matches
        if (existingBucket.public !== bucketConfig.public) {
          console.log(chalk.yellow(`  ⚠ Bucket exists but public setting differs (current: ${existingBucket.public}, expected: ${bucketConfig.public})`));
          console.log(chalk.yellow(`    Please update this in the Supabase dashboard`));
        }
      } else {
        // Create bucket
        const { data, error } = await supabase.storage.createBucket(bucketConfig.name, {
          public: bucketConfig.public
        });
        
        if (error) {
          console.error(chalk.red(`  ✗ Failed to create bucket: ${error.message}`));
          failed++;
        } else {
          console.log(chalk.green(`  ✓ Bucket created successfully`));
          created++;
        }
      }
    } catch (err) {
      console.error(chalk.red(`  ✗ Error processing bucket ${bucketConfig.name}: ${err.message}`));
      failed++;
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Summary:'));
  console.log(chalk.green(`  ✓ Created: ${created}`));
  console.log(chalk.yellow(`  ⚠ Existing: ${existing}`));
  if (failed > 0) {
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
  }

  if (failed === 0) {
    console.log(chalk.green('\n✅ All storage buckets are set up!'));
  } else {
    console.log(chalk.red('\n❌ Some buckets could not be created. Please check the Supabase dashboard.'));
    process.exit(1);
  }
}

// Run setup
setupStorageBuckets().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
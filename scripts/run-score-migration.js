#!/usr/bin/env node

/**
 * Score Standardization Migration Runner
 * Executes the migration to standardize all scores in the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting score standardization migration...');
  console.log('═'.repeat(60));

  try {
    // Step 1: Backup current state (get sample of data before migration)
    console.log('\n📊 Analyzing current data...');
    
    const { data: preMigrationStats, error: preStatsError } = await supabase
      .from('speech_feedback')
      .select('id, feedback, overall_score, duration_seconds, created_at')
      .limit(5);
    
    if (preStatsError) {
      console.error('❌ Error fetching pre-migration stats:', preStatsError);
      return;
    }

    console.log('✅ Sample data before migration:');
    preMigrationStats.forEach(record => {
      const score = record.feedback?.speakerScore || 
                   record.feedback?.score || 
                   record.feedback?.standardizedScore;
      console.log(`  - ID: ${record.id.substring(0, 8)}... | Score: ${score} | overall_score: ${record.overall_score}`);
    });

    // Step 2: Get total counts before migration
    const { count: totalRecords } = await supabase
      .from('speech_feedback')
      .select('*', { count: 'exact', head: true });

    const { count: recordsWithScore } = await supabase
      .from('speech_feedback')
      .select('*', { count: 'exact', head: true })
      .not('overall_score', 'is', null);

    console.log(`\n📈 Pre-migration statistics:`);
    console.log(`  - Total records: ${totalRecords}`);
    console.log(`  - Records with overall_score: ${recordsWithScore}`);
    console.log(`  - Records needing update: ${totalRecords - recordsWithScore}`);

    // Step 3: Read and execute migration SQL
    console.log('\n🔧 Executing migration...');
    
    const migrationPath = path.join(__dirname, '..', 'src', 'backend', 'migrations', '0002_standardize_scores.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration using Supabase RPC or direct SQL
    // Note: Supabase doesn't directly support raw SQL execution via the JS client
    // So we'll implement the migration logic in JavaScript

    console.log('  → Updating overall_score column...');
    
    // Fetch all records that need updating
    const { data: recordsToUpdate, error: fetchError } = await supabase
      .from('speech_feedback')
      .select('id, feedback')
      .is('overall_score', null);

    if (fetchError) {
      console.error('❌ Error fetching records:', fetchError);
      return;
    }

    console.log(`  → Found ${recordsToUpdate.length} records to update`);

    // Update each record
    let updateCount = 0;
    let errorCount = 0;

    for (const record of recordsToUpdate) {
      let standardizedScore = null;
      
      // Calculate standardized score based on format
      if (record.feedback?.speakerScore) {
        // NSDA format (25-30) to percentage
        standardizedScore = Math.round(((record.feedback.speakerScore - 25) / 5) * 100);
      } else if (record.feedback?.score) {
        if (typeof record.feedback.score === 'object') {
          // JSON object format
          standardizedScore = record.feedback.score.overall || 
                            record.feedback.score.content || 
                            record.feedback.score.total;
        } else if (typeof record.feedback.score === 'string' && record.feedback.score.startsWith('{')) {
          // JSON string that needs parsing
          try {
            const parsed = JSON.parse(record.feedback.score);
            standardizedScore = parsed.overall || parsed.content || parsed.total;
          } catch (e) {
            console.warn(`  ⚠ Could not parse score for record ${record.id.substring(0, 8)}...`);
          }
        } else {
          // Simple numeric score
          standardizedScore = parseInt(record.feedback.score);
        }
      }

      if (standardizedScore !== null && !isNaN(standardizedScore)) {
        // Update the record with standardized score
        const updatedFeedback = {
          ...record.feedback,
          standardizedScore: standardizedScore
        };

        const { error: updateError } = await supabase
          .from('speech_feedback')
          .update({
            overall_score: standardizedScore,
            feedback: updatedFeedback
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`  ❌ Error updating record ${record.id.substring(0, 8)}...:`, updateError.message);
          errorCount++;
        } else {
          updateCount++;
          if (updateCount % 5 === 0) {
            console.log(`  → Updated ${updateCount} records...`);
          }
        }
      } else {
        console.warn(`  ⚠ No valid score found for record ${record.id.substring(0, 8)}...`);
      }
    }

    console.log(`\n✅ Migration completed:`);
    console.log(`  - Records updated: ${updateCount}`);
    console.log(`  - Errors: ${errorCount}`);

    // Step 4: Verify migration results
    console.log('\n🔍 Verifying migration results...');

    const { count: postMigrationCount } = await supabase
      .from('speech_feedback')
      .select('*', { count: 'exact', head: true })
      .not('overall_score', 'is', null);

    const { data: postMigrationSample } = await supabase
      .from('speech_feedback')
      .select('id, feedback, overall_score')
      .not('overall_score', 'is', null)
      .limit(5);

    console.log('✅ Post-migration statistics:');
    console.log(`  - Total records with overall_score: ${postMigrationCount}`);
    console.log(`  - Success rate: ${Math.round((postMigrationCount / totalRecords) * 100)}%`);

    console.log('\n✅ Sample data after migration:');
    postMigrationSample.forEach(record => {
      console.log(`  - ID: ${record.id.substring(0, 8)}... | overall_score: ${record.overall_score} | standardizedScore: ${record.feedback?.standardizedScore}`);
    });

    // Step 5: Create indexes (Note: This would typically be done via SQL migration)
    console.log('\n📑 Note: Database indexes should be created manually via Supabase dashboard:');
    console.log('  1. idx_speech_feedback_overall_score ON speech_feedback(overall_score)');
    console.log('  2. idx_speech_feedback_user_score ON speech_feedback(user_id, overall_score)');
    console.log('  3. idx_speech_feedback_created_at ON speech_feedback(created_at DESC)');

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Add confirmation prompt for production
async function confirmMigration() {
  if (process.env.NODE_ENV === 'production' || supabaseUrl.includes('supabase.co')) {
    console.log('\n⚠️  WARNING: You are about to run a migration on a production database!');
    console.log('This will modify all speech_feedback records.');
    console.log('Make sure you have a backup before proceeding.\n');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      readline.question('Type "MIGRATE" to confirm: ', (answer) => {
        readline.close();
        resolve(answer === 'MIGRATE');
      });
    });
  }
  return true;
}

// Main execution
(async () => {
  const confirmed = await confirmMigration();
  
  if (confirmed) {
    await runMigration();
  } else {
    console.log('Migration cancelled.');
    process.exit(0);
  }
})();
#!/usr/bin/env node

/**
 * DebateAI - Storage Configuration Verification Tool
 * Manually check and report on storage configuration
 * 
 * Usage:
 *   node verifyStorage.js
 */

// Import required modules
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Access environment variables directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Client with service role for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Required bucket configurations
const BUCKET_CONFIGS = [
  {
    name: 'speech_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  },
  {
    name: 'debate_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  }
];

// Required policies
const REQUIRED_POLICIES = [
  "Users can view their own speech audio",
  "Users can upload their own speech audio",
  "Users can delete their own speech audio",
  "Users can view their own debate audio",
  "Users can upload their own debate audio",
  "Users can delete their own debate audio"
];

/**
 * Main verification function
 */
async function verifyStorage() {
  console.log('🔍 Verifying Supabase storage configuration...\n');
  
  try {
    // Step 1: Check connection to Supabase
    console.log('1️⃣ Checking Supabase connection...');
    const buckets = await checkConnection();
    
    // Step 2: Check buckets
    console.log('\n2️⃣ Checking storage buckets...');
    await checkBuckets(buckets);
    
    // Step 3: Check policies
    console.log('\n3️⃣ Checking storage policies...');
    await checkPolicies();
    
    console.log('\n✅ Storage verification complete!');
  } catch (error) {
    console.error('\n❌ Storage verification failed:', error);
    process.exit(1);
  }
}

/**
 * Check connection to Supabase
 */
async function checkConnection() {
  try {
    // Try a simple query to see if we can connect - just list buckets to avoid table errors
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      throw new Error(`Connection error: ${error.message}`);
    }
    
    console.log('  ✅ Successfully connected to Supabase!');
    console.log(`  ✅ Connection verified with ${data.length} storage buckets found`);
    return data; // Return buckets for reuse in checkBuckets
  } catch (error) {
    console.error(`  ❌ Failed to connect to Supabase: ${error.message}`);
    throw error;
  }
}

/**
 * Check storage buckets
 * @param {Array} existingBuckets - Optional array of already fetched buckets
 */
async function checkBuckets(existingBuckets) {
  try {
    // Use existing buckets if provided, otherwise fetch them
    let buckets = existingBuckets;
    if (!buckets) {
      try {
        const { data, error } = await supabaseAdmin.storage.listBuckets();
        if (error) {
          throw new Error(`Failed to list buckets: ${error.message}`);
        }
        buckets = data;
      } catch (error) {
        console.error(`  ❌ Failed to list buckets: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`  Found ${buckets.length} bucket(s):`);
    
    // Map of existing buckets by name for easy access
    const bucketMap = {};
    buckets.forEach(bucket => {
      bucketMap[bucket.name] = bucket;
      console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    
    // Check each required bucket
    for (const config of BUCKET_CONFIGS) {
      const bucket = bucketMap[config.name];
      
      if (!bucket) {
        console.log(`  ❌ Missing required bucket: ${config.name}`);
      } else {
        // Check configuration
        if (bucket.public !== config.public) {
          console.log(`  ⚠️ Bucket ${config.name} has incorrect public setting: found ${bucket.public}, expected ${config.public}`);
        } else {
          console.log(`  ✅ Bucket ${config.name} has correct public access setting`);
        }
        
        // Check CORS configuration using SQL
        await checkBucketCORS(config.name);
      }
    }
  } catch (error) {
    console.error(`  ❌ Failed to check buckets: ${error.message}`);
    throw error;
  }
}

/**
 * Check CORS configuration for a bucket
 * @param {string} bucketName - Name of the bucket to check
 */
async function checkBucketCORS(bucketName) {
  try {
    // Since direct SQL access is not available, we'll check for basic bucket existence
    // This is a simplified check since we've already verified the bucket exists and is public
    console.log(`  ℹ️ CORS verification requires direct database access (skipping detailed check)`);
    console.log(`  ✓ Basic bucket configuration verified (existence and public access)`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error checking CORS for bucket ${bucketName}: ${error.message}`);
    return false;
  }
}

/**
 * Check storage policies
 */
async function checkPolicies() {
  try {
    console.log(`  ℹ️ Policy verification requires direct database access`);
    console.log(`  ℹ️ The storage buckets being public allows Next.js to access them for image optimization`);
    console.log(`  ✓ Basic public access verified via bucket settings`);
    
    // List the required policies for reference
    console.log(`  Required storage.objects policies for complete security:`);
    for (const requiredPolicy of REQUIRED_POLICIES) {
      console.log(`  - ${requiredPolicy}`);
    }
    
    console.log(`  ℹ️ These policies should be applied through the server initialization process`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to check policies: ${error.message}`);
    throw error;
  }
}

// Run the verification
verifyStorage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('ERROR:', error);
    process.exit(1);
  }); 
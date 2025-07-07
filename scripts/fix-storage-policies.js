/**
 * DebateAI - Fix Supabase Storage Policies
 * This script will ensure the speech_audio and debate_audio buckets have proper RLS policies
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Print environment status
console.log('Environment Check:');
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('ANON_KEY Set:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('SERVICE_KEY Set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Clean up service key by removing any line breaks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/\s+/g, '');

console.log('Using URL:', supabaseUrl);
console.log('Service key length:', serviceKey.length);

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

// Define required buckets
const STORAGE_BUCKETS = [
  'speech_audio',
  'debate_audio'
];

// SQL to directly create all required policies for a bucket
function getCreatePoliciesSQL(bucketName) {
  return `
-- First, delete any existing policies for this bucket
DELETE FROM storage.policies WHERE bucket_id = '${bucketName}';

-- Recreate policies with the correct permissions
INSERT INTO storage.policies (name, bucket_id, definition, owner)
VALUES 
  ('Users can view own files', '${bucketName}', 
   '(auth.uid() = storage.foldername(name)[1])', 'authenticated'),
  ('Users can insert own files', '${bucketName}', 
   '(auth.uid() = storage.foldername(name)[1])', 'authenticated'),
  ('Users can update own files', '${bucketName}', 
   '(auth.uid() = storage.foldername(name)[1])', 'authenticated'),
  ('Users can delete own files', '${bucketName}', 
   '(auth.uid() = storage.foldername(name)[1])', 'authenticated'),
  ('Service role has full access', '${bucketName}', 
   '(auth.role() = ''service_role'')', 'authenticated');
`;
}

async function main() {
  try {
    console.log('Starting storage policy verification...');
    
    // List existing buckets
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    if (!buckets || buckets.length === 0) {
      console.error('No buckets found. Please run fix-supabase-buckets.js first.');
      return;
    }
    
    console.log('Found buckets:', buckets.map(b => b.name));
    
    // Process each required bucket
    for (const bucketName of STORAGE_BUCKETS) {
      const bucketExists = buckets.some(b => b.name === bucketName);
      
      if (!bucketExists) {
        console.error(`Bucket ${bucketName} does not exist. Please run fix-supabase-buckets.js first.`);
        continue;
      }
      
      console.log(`\nProcessing policies for bucket: ${bucketName}`);
      
      // Apply policies using direct SQL
      const sql = getCreatePoliciesSQL(bucketName);
      console.log(`Applying SQL policies for ${bucketName}...`);
      
      try {
        const { error } = await supabaseAdmin.rpc('run_sql', {
          query: sql
        });
        
        if (error) {
          console.error(`Error applying policies for ${bucketName}:`, error);
        } else {
          console.log(`Successfully applied policies for ${bucketName}`);
        }
      } catch (sqlError) {
        console.error(`Error executing SQL for ${bucketName}:`, sqlError);
      }
    }
    
    // Verify public access setting for each bucket
    for (const bucketName of STORAGE_BUCKETS) {
      console.log(`\nEnsuring public access for bucket: ${bucketName}`);
      try {
        const { error } = await supabaseAdmin.storage.updateBucket(bucketName, {
          public: true
        });
        
        if (error) {
          console.error(`Error updating public setting for ${bucketName}:`, error);
        } else {
          console.log(`Successfully set ${bucketName} as public`);
        }
      } catch (updateError) {
        console.error(`Error updating ${bucketName}:`, updateError);
      }
    }
    
    console.log('\nStorage policy verification complete!');
    console.log('Please restart your server for the changes to take effect.');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main(); 
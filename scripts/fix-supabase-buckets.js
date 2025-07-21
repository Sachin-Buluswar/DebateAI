/**
 * Eris Debate - Fix Supabase Storage Buckets
 * This script will ensure the speech_audio and debate_audio buckets exist
 * with the correct settings for file size (60MB for 1 hour MP3) and MIME types
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

// Define required buckets and settings
const requiredBuckets = [
  {
    id: 'speech_audio',
    name: 'speech_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB (enough for 1 hour of MP3 audio)
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  },
  {
    id: 'debate_audio',
    name: 'debate_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB (enough for 1 hour of MP3 audio)
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  }
];

async function main() {
  try {
    console.log('Starting bucket verification...');
    
    // Skip database connection check and go straight to bucket verification
    console.log('Checking storage buckets...');
    
    // List existing buckets
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    console.log('Existing buckets:', existingBuckets?.map(b => b.name) || []);
    
    // Check each required bucket
    for (const bucketConfig of requiredBuckets) {
      const exists = existingBuckets?.some(b => b.name === bucketConfig.name) || false;
      
      if (exists) {
        console.log(`Updating bucket: ${bucketConfig.name}`);
        
        try {
          // Update bucket settings
          const { error: updateError } = await supabaseAdmin.storage.updateBucket(
            bucketConfig.name, 
            {
              public: bucketConfig.public,
              fileSizeLimit: bucketConfig.fileSizeLimit,
              allowedMimeTypes: bucketConfig.allowedMimeTypes
            }
          );
          
          if (updateError) {
            console.error(`Error updating bucket ${bucketConfig.name}:`, updateError);
          } else {
            console.log(`Successfully updated bucket: ${bucketConfig.name}`);
          }
        } catch (err) {
          console.error(`Error updating bucket ${bucketConfig.name}:`, err);
        }
      } else {
        console.log(`Creating missing bucket: ${bucketConfig.name}`);
        
        try {
          // Create the bucket
          const { error: createError } = await supabaseAdmin.storage.createBucket(
            bucketConfig.name,
            {
              public: bucketConfig.public,
              fileSizeLimit: bucketConfig.fileSizeLimit,
              allowedMimeTypes: bucketConfig.allowedMimeTypes
            }
          );
          
          if (createError) {
            console.error(`Error creating bucket ${bucketConfig.name}:`, createError);
          } else {
            console.log(`Successfully created bucket: ${bucketConfig.name}`);
            
            // Add RLS policy for the new bucket
            console.log(`Setting up RLS policies for bucket: ${bucketConfig.name}`);
            try {
              const policyName = `Users can upload, view and delete their own files`;
              const { error: policyError } = await supabaseAdmin.storage.from(bucketConfig.name).createPolicy(
                policyName,
                {
                  name: policyName,
                  definition: "(auth.uid() = storage.foldername(name)[1])",
                  check: null,
                  allow: 'ALL'
                }
              );
              
              if (policyError) {
                console.error(`Error creating policy for ${bucketConfig.name}:`, policyError);
              } else {
                console.log(`Successfully created policy for bucket: ${bucketConfig.name}`);
              }
            } catch (policyErr) {
              console.error(`Error creating policy for ${bucketConfig.name}:`, policyErr);
            }
          }
        } catch (err) {
          console.error(`Error creating bucket ${bucketConfig.name}:`, err);
        }
      }
    }
    
    // Verify final state
    const { data: finalBuckets, error: finalError } = await supabaseAdmin.storage.listBuckets();
    if (finalError) {
      console.error('Error listing final buckets:', finalError);
    } else {
      console.log('Final buckets:', finalBuckets.map(b => b.name));
    }
    
    console.log('Storage bucket verification complete!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main(); 
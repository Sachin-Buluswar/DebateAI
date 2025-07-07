// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Access environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set (not showing for security)' : 'Not set');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Set (not showing for security)' : 'Not set');

// Create Supabase clients
console.log('Creating public client...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Creating admin client...');
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSupabaseConnection() {
  try {
    // Check if we can connect to Supabase
    console.log('Checking Supabase connection...');
    const { data, error } = await supabase.from('speech_feedback').select('*').limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
      return;
    }
    
    console.log('Successfully connected to Supabase!');
    console.log('Speech feedback data:', data);
    
    // Check buckets
    console.log('\nChecking storage buckets...');
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error listing buckets:', bucketError.message);
      console.error('Error details:', bucketError);
      return;
    }
    
    console.log('Existing buckets:', buckets.map(b => b.name));
    
    // Check if required buckets exist
    const requiredBuckets = ['speech_audio', 'debate_audio'];
    const missingBuckets = requiredBuckets.filter(
      required => !buckets.some(bucket => bucket.name === required)
    );
    
    if (missingBuckets.length > 0) {
      console.log('Missing buckets:', missingBuckets);
      
      // Create missing buckets
      for (const bucketName of missingBuckets) {
        console.log(`Creating bucket: ${bucketName}...`);
        const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 62914560, // 60MB (enough for 1 hour of MP3 audio)
          allowed_mime_types: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
        });
        
        if (error) {
          console.error(`Error creating bucket ${bucketName}:`, error.message);
        } else {
          console.log(`Successfully created bucket: ${bucketName}`);
        }
      }
    } else {
      console.log('All required buckets exist!');
      
      // Update existing buckets to ensure they have the correct settings
      for (const bucketName of requiredBuckets) {
        console.log(`Updating bucket: ${bucketName}...`);
        const { error } = await supabaseAdmin.storage.updateBucket(bucketName, {
          public: true,
          fileSizeLimit: 62914560, // 60MB (enough for 1 hour of MP3 audio)
          allowed_mime_types: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
        });
        
        if (error) {
          console.error(`Error updating bucket ${bucketName}:`, error.message);
        } else {
          console.log(`Successfully updated bucket: ${bucketName}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the check
checkSupabaseConnection(); 
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function setupDebateAudioBucket() {
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

  console.log('🔍 Checking for debate_audio storage bucket...');

  try {
    // List existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      process.exit(1);
    }

    const debateAudioBucket = buckets?.find(bucket => bucket.name === 'debate_audio');

    if (debateAudioBucket) {
      console.log('✅ debate_audio bucket already exists');
      console.log('   Bucket details:', {
        id: debateAudioBucket.id,
        name: debateAudioBucket.name,
        public: debateAudioBucket.public,
        created_at: debateAudioBucket.created_at
      });
    } else {
      console.log('📦 Creating debate_audio bucket...');

      const { data, error: createError } = await supabase.storage.createBucket('debate_audio', {
        public: false,
        fileSizeLimit: 10485760, // 10MB limit for audio files
        allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm']
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        console.error('\nNote: You may need to create this bucket manually in the Supabase dashboard:');
        console.error('1. Go to Storage in your Supabase dashboard');
        console.error('2. Click "New bucket"');
        console.error('3. Name it "debate_audio"');
        console.error('4. Set it as private (not public)');
        console.error('5. Set file size limit to 10MB');
        console.error('6. Add allowed MIME types: audio/mpeg, audio/mp3, audio/wav, audio/webm');
        process.exit(1);
      }

      console.log('✅ debate_audio bucket created successfully');
      console.log('   Bucket ID:', data.name);
    }

    // Create RLS policies for the bucket
    console.log('\n📋 Setting up RLS policies for debate_audio bucket...');
    console.log('   Note: RLS policies must be created manually in Supabase dashboard');
    console.log('   Recommended policies:');
    console.log('   - SELECT: Allow authenticated users to read their own debate audio files');
    console.log('   - INSERT: Allow authenticated users to upload audio for their debates');
    console.log('   - DELETE: Allow users to delete their own audio files');

    console.log('\n✨ Debate audio bucket setup complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the setup
setupDebateAudioBucket();
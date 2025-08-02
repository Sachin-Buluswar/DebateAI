#!/usr/bin/env node

/**
 * Script to set up the debate-documents storage bucket in Supabase
 * This bucket stores PDF documents for the debate evidence search feature
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Validate environment variables
const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('   Please ensure these are set in your .env.local file');
  process.exit(1);
}

// Create Supabase client with service role key (admin access)
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

async function setupDebateDocumentsBucket() {
  try {
    console.log('🔍 Checking for debate-documents storage bucket...');
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      throw listError;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === 'debate-documents');
    
    if (bucketExists) {
      console.log('✅ debate-documents bucket already exists');
      const existingBucket = buckets.find(bucket => bucket.name === 'debate-documents');
      console.log('   Bucket details:', existingBucket);
    } else {
      console.log('📦 Creating debate-documents storage bucket...');
      
      // Create the bucket with appropriate settings
      const { data, error: createError } = await supabase.storage.createBucket('debate-documents', {
        public: true, // Public read access for PDFs
        fileSizeLimit: 52428800, // 50MB limit for PDF files
        allowedMimeTypes: ['application/pdf'] // Only allow PDF files
      });
      
      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        throw createError;
      }
      
      console.log('✅ Successfully created debate-documents bucket');
      console.log('   Bucket details:', data);
    }
    
    // Provide RLS policy recommendations
    console.log('\n📋 Setting up RLS policies for debate-documents bucket...');
    console.log('   Note: RLS policies must be created manually in Supabase dashboard');
    console.log('   Recommended policies:');
    console.log('   - SELECT: Allow all users to read documents (public access)');
    console.log('   - INSERT: Allow authenticated users to upload documents');
    console.log('   - UPDATE: Allow users to update their own documents');
    console.log('   - DELETE: Allow users to delete their own documents or admins to delete any');
    
    // Provide manual setup instructions if automated creation fails
    console.log('\n📝 Manual Setup Instructions (if needed):');
    console.log('   1. Go to Supabase Dashboard → Storage');
    console.log('   2. Click "New bucket"');
    console.log('   3. Name: debate-documents');
    console.log('   4. Public: ✅ Yes (check this box)');
    console.log('   5. File size limit: 50MB');
    console.log('   6. Allowed MIME types: application/pdf');
    console.log('   7. Click "Create bucket"');
    
    console.log('\n✨ Debate documents bucket setup complete!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n🔧 Please create the bucket manually in Supabase dashboard');
    process.exit(1);
  }
}

// Run the setup
setupDebateDocumentsBucket();
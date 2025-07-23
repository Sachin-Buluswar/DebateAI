#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking database state...\n');

  // Check if documents table exists
  const { data: documentsTables, error: docsError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'documents');

  if (docsError) {
    console.error('Error checking documents table:', docsError);
  } else {
    console.log('Documents table exists:', documentsTables && documentsTables.length > 0);
  }

  // Check if document_chunks table exists
  const { data: chunksTables, error: chunksError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'document_chunks');

  if (chunksError) {
    console.error('Error checking document_chunks table:', chunksError);
  } else {
    console.log('Document chunks table exists:', chunksTables && chunksTables.length > 0);
  }

  // Check for storage buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('Error checking buckets:', bucketsError);
  } else {
    console.log('\nStorage buckets:', buckets?.map(b => b.name));
    const debateBucket = buckets?.find(b => b.name === 'debate-documents');
    console.log('debate-documents bucket exists:', !!debateBucket);
  }

  // Check for pg_trgm extension
  try {
    const { data: extensions, error: extError } = await supabase.rpc('get_installed_extensions');
    if (extError) {
      console.log('\nCould not check extensions (function might not exist)');
    } else {
      const hasPgTrgm = extensions?.some(ext => ext.extname === 'pg_trgm');
      console.log('\npg_trgm extension installed:', hasPgTrgm);
    }
  } catch (e) {
    console.log('\nCould not check extensions:', e.message);
  }

  // Try to query documents table directly
  console.log('\n📊 Testing direct queries...');
  
  try {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('Documents table query error:', error.message);
    } else {
      console.log('Documents count:', count);
    }
  } catch (e) {
    console.log('Documents table error:', e.message);
  }

  try {
    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('Document chunks table query error:', error.message);
    } else {
      console.log('Document chunks count:', count);
    }
  } catch (e) {
    console.log('Document chunks table error:', e.message);
  }

  console.log('\n✨ Database check complete!');
  console.log('\n📝 To fix issues:');
  console.log('1. Run migrations directly in Supabase SQL editor');
  console.log('2. Enable pg_trgm extension in Supabase dashboard');
  console.log('3. Create storage bucket if missing');
}

checkDatabase().catch(console.error);
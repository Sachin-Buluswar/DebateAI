/**
 * Script to check documents and chunks in the database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDocuments() {
  console.log('📚 Checking Documents in Database...\n');
  
  // 1. Count total documents
  const { count: docCount, error: docCountError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });
    
  if (docCountError) {
    console.error('❌ Error counting documents:', docCountError);
    return;
  }
  
  console.log(`Total documents: ${docCount || 0}`);
  
  // 2. Get sample documents
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .limit(5)
    .order('created_at', { ascending: false });
    
  if (docError) {
    console.error('❌ Error fetching documents:', docError);
    return;
  }
  
  if (documents && documents.length > 0) {
    console.log('\nRecent documents:');
    documents.forEach(doc => {
      console.log(`\n- ${doc.title}`);
      console.log(`  File: ${doc.file_name}`);
      console.log(`  Type: ${doc.source_type}`);
      console.log(`  Indexed: ${doc.indexed_at ? '✅ Yes' : '❌ No'}`);
      console.log(`  Created: ${new Date(doc.created_at).toLocaleDateString()}`);
    });
  }
  
  // 3. Count document chunks
  const { count: chunkCount, error: chunkCountError } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nTotal chunks: ${chunkCount || 0}`);
  
  // 4. Check chunks with OpenAI file IDs
  const { count: openaiChunkCount } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .not('openai_file_id', 'is', null);
    
  console.log(`Chunks with OpenAI file IDs: ${openaiChunkCount || 0}`);
  
  // 5. Sample search
  if (chunkCount > 0) {
    console.log('\n🔍 Testing sample search for "China"...');
    const { data: searchResults, error: searchError } = await supabase
      .from('document_chunks')
      .select('content, documents!inner(title)')
      .ilike('content', '%China%')
      .limit(3);
      
    if (searchResults && searchResults.length > 0) {
      console.log(`Found ${searchResults.length} results`);
      searchResults.forEach((result, idx) => {
        console.log(`\n${idx + 1}. From: ${result.documents.title}`);
        console.log(`   Preview: ${result.content.substring(0, 100)}...`);
      });
    } else {
      console.log('No results found for "China"');
    }
  }
  
  // 6. Check storage bucket
  console.log('\n📁 Checking storage bucket...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (buckets) {
    const debateBucket = buckets.find(b => b.name === 'debate-documents');
    if (debateBucket) {
      console.log('✅ debate-documents bucket exists');
      
      // List some files
      const { data: files, error: filesError } = await supabase.storage
        .from('debate-documents')
        .list('', { limit: 5 });
        
      if (files && files.length > 0) {
        console.log(`Files in bucket: ${files.length}`);
      } else {
        console.log('No files in bucket');
      }
    } else {
      console.log('❌ debate-documents bucket not found');
    }
  }
  
  console.log('\n✨ Document check complete!');
}

// Run the check
checkDocuments().catch(console.error);
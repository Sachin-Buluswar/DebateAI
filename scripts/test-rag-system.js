/**
 * Test script for Document Search system functionality
 * Tests document retrieval and search capabilities
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDocumentSearchSystem() {
  console.log('🔍 Testing Document Search System...\n');
  
  // 1. Check if documents exist
  console.log('1. Checking documents in database...');
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, title, file_name, indexed_at, source_type')
    .limit(10);
    
  if (docError) {
    console.error('❌ Error fetching documents:', docError);
    return;
  }
  
  console.log(`✅ Found ${documents?.length || 0} documents`);
  if (documents && documents.length > 0) {
    console.log('\nSample documents:');
    documents.slice(0, 3).forEach(doc => {
      console.log(`  - ${doc.title} (${doc.source_type}) - Indexed: ${doc.indexed_at ? 'Yes' : 'No'}`);
    });
  }
  
  // 2. Check if document chunks exist
  console.log('\n2. Checking document chunks...');
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('id, document_id, chunk_index, openai_file_id')
    .limit(10);
    
  if (chunkError) {
    console.error('❌ Error fetching chunks:', chunkError);
    return;
  }
  
  console.log(`✅ Found ${chunks?.length || 0} document chunks`);
  
  // 3. Test a simple text search in documents
  console.log('\n3. Testing text search in documents...');
  const testQuery = 'China';
  const { data: searchResults, error: searchError } = await supabase
    .from('document_chunks')
    .select('*, documents!inner(title, file_name)')
    .textSearch('content', testQuery)
    .limit(5);
    
  if (searchError) {
    console.error('❌ Error searching:', searchError);
  } else {
    console.log(`✅ Found ${searchResults?.length || 0} results for query "${testQuery}"`);
    if (searchResults && searchResults.length > 0) {
      console.log('\nSample results:');
      searchResults.slice(0, 2).forEach(result => {
        console.log(`  - Document: ${result.documents.title}`);
        console.log(`    Content preview: ${result.content.substring(0, 100)}...`);
      });
    }
  }
  
  // 4. Check vector store configuration
  console.log('\n4. Checking OpenAI Vector Store configuration...');
  console.log(`Vector Store ID: ${process.env.OPENAI_VECTOR_STORE_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  
  // 5. Test the API endpoint
  console.log('\n5. Testing Document Search API endpoint...');
  try {
    const response = await fetch('http://localhost:3001/api/wiki-document-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'US China relationship',
        maxResults: 5
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API responded successfully`);
      console.log(`Results returned: ${data.results?.length || 0}`);
    } else {
      console.error(`❌ API returned status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
    }
  } catch (error) {
    console.error('❌ Failed to call API:', error.message);
  }
  
  console.log('\n✨ Document Search System test complete!');
}

// Run the test
testDocumentSearchSystem().catch(console.error);
/**
 * Test script for direct document search functionality
 * Tests the direct database search for document chunks with context
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function testDocumentSearch() {
  console.log('🔍 Testing Direct Document Search System...\n');
  
  const testQueries = [
    'US China relationship',
    'political implications',
    'single use plastics',
    'environmental policies',
    'economic military',
    'debate evidence'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    console.log('─'.repeat(50));
    
    try {
      const response = await fetch('http://localhost:3001/api/wiki-document-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          maxResults: 5
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success! Found ${data.results?.length || 0} results`);
        
        if (data.results && data.results.length > 0) {
          console.log('\nTop results:');
          data.results.slice(0, 3).forEach((result, idx) => {
            console.log(`\n${idx + 1}. ${result.source} (Page ${result.page_number || 'N/A'})`);
            console.log(`   Score: ${Math.round(result.score * 100)}%`);
            console.log(`   Content: ${result.content.substring(0, 150)}...`);
            if (result.pdf_url) {
              console.log(`   PDF: ${result.pdf_url}${result.pdf_page_anchor || ''}`);
            }
          });
        } else {
          console.log('❌ No results found for this query');
        }
      } else {
        console.error(`❌ API returned status: ${response.status}`);
        const errorText = await response.text();
        console.error('Error response:', errorText.substring(0, 200));
      }
    } catch (error) {
      console.error('❌ Failed to call API:', error.message);
    }
  }
  
  console.log('\n\n✨ Document search test complete!');
}

// Run the test
testDocumentSearch().catch(console.error);
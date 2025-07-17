const { createClient } = require('@supabase/supabase-js');
const { EnhancedIndexingService } = require('../src/backend/services/enhancedIndexingService');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reindexAllDocuments() {
  console.log('Starting document reindexing...');
  
  try {
    // Get all documents that haven't been indexed with the new system
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .is('indexed_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching documents:', error);
      return;
    }

    console.log(`Found ${documents.length} documents to reindex`);

    const indexingService = new EnhancedIndexingService();

    for (const document of documents) {
      console.log(`\nReindexing: ${document.file_name}`);
      
      try {
        // Delete any existing chunks for this document
        await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', document.id);

        // Reindex with enhanced metadata
        await indexingService.indexPDFDocument(
          document.id,
          document.file_url,
          document.file_name
        );

        console.log(`✓ Successfully reindexed: ${document.file_name}`);
      } catch (error) {
        console.error(`✗ Failed to reindex ${document.file_name}:`, error.message);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\nReindexing complete!');
    
    // Show summary
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .not('indexed_at', 'is', null);

    console.log(`Total indexed documents: ${count}`);
  } catch (error) {
    console.error('Fatal error during reindexing:', error);
  }
}

// Run the reindexing
reindexAllDocuments();
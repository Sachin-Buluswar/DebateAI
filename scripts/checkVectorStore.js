// Script to check OpenAI Vector Store contents
require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');

async function checkVectorStore() {
  // Get environment variables
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

  if (!openaiApiKey) {
    console.error('Error: OPENAI_API_KEY is not set in .env.local');
    process.exit(1);
  }

  if (!vectorStoreId) {
    console.error('Error: OPENAI_VECTOR_STORE_ID is not set in .env.local');
    process.exit(1);
  }

  console.log(`Using Vector Store ID: ${vectorStoreId}`);

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // List files available in the API
    console.log('Checking files available to the API...');
    const files = await openai.files.list();
    
    if (files.data.length === 0) {
      console.log('No files found. You need to upload files before search will work.');
    } else {
      console.log(`Found ${files.data.length} files:`);
      for (const file of files.data) {
        console.log(`- ${file.id}: ${file.filename} (${file.bytes} bytes, purpose: ${file.purpose})`);
        
        // If files are vector_search_file type, they should have vector_store_id in metadata
        if (file.purpose === 'vector_search_file' && file.metadata) {
          console.log(`  Metadata: ${JSON.stringify(file.metadata)}`);
        }
      }
    }

    // Try creating a basic assistant to check API connectivity
    console.log('\nTesting API by creating a temporary assistant...');
    const tempAssistant = await openai.beta.assistants.create({
      name: "Test Assistant (Temporary)",
      instructions: "This is a test assistant to verify API connectivity",
      model: "gpt-4o",
    });
    console.log(`Successfully created temporary assistant with ID: ${tempAssistant.id}`);
    
    // Clean up by deleting the temporary assistant
    await openai.beta.assistants.del(tempAssistant.id);
    console.log(`Successfully deleted temporary assistant`);

    // Key vectors store test - attempt to use file search with the vector store
    console.log('\nTesting Vector Store by creating a temporary search assistant...');
    try {
      const searchAssistant = await openai.beta.assistants.create({
        name: "Vector Search Test (Temporary)",
        instructions: "Test vector store connectivity",
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId]
          }
        }
      });
      console.log(`Successfully created temporary vector search assistant with ID: ${searchAssistant.id}`);
      
      // Create a test thread and run a basic search
      const thread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: "Test search query",
      });
      
      console.log(`Created test thread and running search...`);
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: searchAssistant.id,
      });
      
      console.log(`Run created with ID: ${run.id}. Vector store appears to be configured correctly.`);
      
      // Clean up
      await openai.beta.assistants.del(searchAssistant.id);
      await openai.beta.threads.del(thread.id);
    } catch (error) {
      console.error('Vector store search test failed:', error);
      console.log('This likely means your vector store is not configured correctly or has no data.');
    }

  } catch (error) {
    console.error('Error checking OpenAI API:', error);
  }
}

checkVectorStore().catch(console.error); 
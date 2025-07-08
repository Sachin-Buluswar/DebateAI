import OpenAI from 'openai';
import { Buffer } from 'buffer'; // Use Buffer for file content
import { toFile } from 'openai/uploads'; // Import the toFile helper
import { wikiSearchConfig } from './wikiSearch.config';

// Placeholder for chunking logic
const chunkText = (text: string, chunkSize = wikiSearchConfig.chunkSize, overlap = wikiSearchConfig.chunkOverlap): string[] => {
  console.log(`Chunking text of length ${text.length}`);
  // Basic chunking logic (can be refined later)
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
    if (start >= text.length - overlap && end < text.length) {
        // Ensure the last part is included if overlap logic skips it
        chunks.push(text.substring(text.length - (chunkSize - overlap)));
        break;
    }
  }
  console.log(`Generated ${chunks.length} chunks`);
  return chunks;
};

// Replaced placeholder with OpenAI Vector Store file batch upload
// This function now uploads chunks as files to a specified Vector Store.
// Metadata handling needs refinement based on Vector Store capabilities.
const storeChunksInVectorStore = async (
  openai: OpenAI,
  vectorStoreId: string,
  chunks: string[],
  fileName: string // Use original filename for context
): Promise<void> => {
  console.log(`[storeChunks] Uploading ${chunks.length} chunks from ${fileName} to Vector Store ID: ${vectorStoreId}`);
  if (!vectorStoreId || !vectorStoreId.startsWith('vs_')) {
    console.error(`[storeChunks] Invalid or missing Vector Store ID provided: ${vectorStoreId}`);
    throw new Error(`Invalid Vector Store ID: ${vectorStoreId}`);
  }

  const uploadedFileIds: string[] = []; // Keep track of files successfully uploaded

  try {
    // 1. Upload each chunk as a temporary file to OpenAI
    const fileUploadPromises = chunks.map(async (chunk, index) => {
      const chunkFileName = `${fileName}_chunk_${index}.txt`;
      const chunkBuffer = Buffer.from(chunk, 'utf-8');
      console.log(`[storeChunks] Uploading chunk ${index} as ${chunkFileName} (${chunkBuffer.length} bytes)...`);

      try {
        const fileLike = await toFile(chunkBuffer, chunkFileName, { type: 'text/plain' });
        const fileObject = await openai.files.create({
          file: fileLike,
          purpose: 'assistants',
        });
        console.log(`[storeChunks] Uploaded chunk ${index}, File ID: ${fileObject.id}`);
        uploadedFileIds.push(fileObject.id); // Add to list only on successful upload
        return fileObject.id;
      } catch (uploadError) {
        console.error(`[storeChunks] Failed to upload chunk ${index} (${chunkFileName}):`, uploadError);
        // Decide how to handle partial failures: throw immediately or collect errors?
        // For now, log and return null/undefined to filter out later
        return null;
      }
    });

    const maybeFileIds = await Promise.all(fileUploadPromises);
    const fileIds = maybeFileIds.filter((id): id is string => id !== null); // Filter out nulls from failed uploads

    if (fileIds.length === 0) {
      console.error(`[storeChunks] No chunk files were successfully uploaded for ${fileName}. Aborting batch creation.`);
      // Consider cleanup of potentially uploaded files if needed, though complex.
      throw new Error(`Failed to upload any chunks for ${fileName}.`);
    }

    console.log(`[storeChunks] Successfully uploaded ${fileIds.length} / ${chunks.length} chunk files for ${fileName}.`);

    // 2. Add these files to the Vector Store in a batch
    console.log(`[storeChunks] Creating file batch for Vector Store ${vectorStoreId} with ${fileIds.length} files...`);

    let batch: any;
    try {
        // Use direct API call instead of beta client method
        const createResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/file_batches`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({ file_ids: fileIds })
        });
        
        batch = await createResponse.json();
        
        // Poll for completion
        while (batch.status === 'in_progress') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const pollResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/file_batches/${batch.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
          batch = await pollResponse.json();
        }
    } catch (batchCreateError) {
        console.error(`[storeChunks] FATAL ERROR during createAndPoll for vector store ${vectorStoreId}:`, batchCreateError);
        console.log(`[storeChunks] Attempting to delete ${uploadedFileIds.length} uploaded files due to batch creation failure...`);
        const deletePromises = uploadedFileIds.map(id => 
            openai.files.delete(id).catch(delErr => console.error(`[storeChunks] Failed to delete uploaded file ${id}:`, delErr))
        );
        await Promise.all(deletePromises);
        throw batchCreateError; 
    }
    // -----------------------------------------------

    // --- Detailed Logging of Batch Results --- 
    if (batch) {
      console.log(`[storeChunks] File batch ${batch.id} processing finished. Status: ${batch.status}`);
      console.log(`  Total files submitted: ${batch.file_counts?.total || 0}`);
      console.log(`  In progress: ${batch.file_counts?.in_progress || 0}`);
      console.log(`  Completed: ${batch.file_counts?.completed || 0}`);
      console.log(`  Failed: ${batch.file_counts?.failed || 0}`);
      console.log(`  Cancelled: ${batch.file_counts?.cancelled || 0}`);
      // ------------------------------------------

      if (batch.status !== 'completed' || (batch.file_counts?.failed || 0) > 0 || (batch.file_counts?.cancelled || 0) > 0) {
        console.error(`[storeChunks] Vector Store file batch ${batch.id} did not complete successfully for ${fileName}. Status: ${batch.status}. Failed: ${batch.file_counts?.failed || 0}, Cancelled: ${batch.file_counts?.cancelled || 0}`);
        // If some files failed, they are likely still in the Vector Store if the batch was partially processed.
        // If the whole batch failed/cancelled, the files might not be attached.
        // The files we uploaded earlier are *still* in the general OpenAI Files area unless deleted.
        // Consider logging the specific failed file IDs if the API provides them (might need listFiles method)
        // try {
        //     const batchFiles = await openai.beta.vectorStores.fileBatches.listFiles(vectorStoreId, batch.id);
        //     console.error("[storeChunks] Batch file details:", JSON.stringify(batchFiles.data, null, 2));
        // } catch (listError) {
        //     console.error("[storeChunks] Could not list files in failed batch:", listError);
        // }

        // Decide on error handling: Throw an error to signal failure back up the chain?
        throw new Error(`Vector Store batch processing failed for ${fileName}. Status: ${batch.status}, Failed: ${batch.file_counts?.failed || 0}, Cancelled: ${batch.file_counts?.cancelled || 0}`);
      } else {
        console.log(`[storeChunks] Successfully added ${batch.file_counts?.completed || 0} files from ${fileName} to Vector Store ${vectorStoreId}.`);
      }
    } else {
      throw new Error(`Vector Store batch processing failed for ${fileName}. Batch object was not created successfully.`);
    }

  } catch (error) {
    // Log intermediate errors from upload/batching steps above
    // This catch block handles errors thrown explicitly or unexpected issues
    console.error(`[storeChunks] Error storing chunks for ${fileName} in OpenAI Vector Store:`, error);
    throw error; // Re-throw error to be caught by the caller (API route or script)
  }
};

/**
 * Processes a single document (file content) for indexing in OpenAI Vector Store.
 * - Chunks the document text.
 * - Uploads chunks as files to OpenAI.
 * - Adds the files to the specified Vector Store via a batch.
 * @param openai Initialized OpenAI client instance.
 * @param vectorStoreId The ID of the target OpenAI Vector Store.
 * @param fileContent The content of the file.
 * @param fileName The name of the source file for metadata/context.
 */
export const processAndIndexDocument = async (
    openai: OpenAI,
    vectorStoreId: string,
    fileContent: string,
    fileName: string
): Promise<void> => {
  try {
    console.log(`[processAndIndex] Starting OpenAI Vector Store processing for document: ${fileName}`);

    if (!vectorStoreId) {
      console.error("[processAndIndex] Vector Store ID is missing!");
      throw new Error("Vector Store ID is required for indexing.");
    }
    if (!openai) {
      console.error("[processAndIndex] OpenAI client is missing!");
      throw new Error("OpenAI client is required for indexing.");
    }

    const chunks = chunkText(fileContent);

    if (!chunks || chunks.length === 0) {
      console.warn(`[processAndIndex] No chunks generated for ${fileName}. Skipping vector store upload.`);
      return;
    }

    // Store the chunks in the vector store
    await storeChunksInVectorStore(openai, vectorStoreId, chunks, fileName);

    console.log(`[processAndIndex] Successfully processed and initiated indexing for document: ${fileName} in Vector Store ${vectorStoreId}`);
  } catch (error) {
    console.error(`[processAndIndex] Error processing document ${fileName} for Vector Store:`, error);
    throw error; // Re-throw error
  }
}; 
import OpenAI from 'openai';
import { Buffer } from 'buffer'; // Use Buffer for file content
import { toFile } from 'openai/uploads'; // Import the toFile helper
import { wikiSearchConfig } from './wikiSearch.config';

// Placeholder for chunking logic
const chunkText = (text: string, chunkSize = wikiSearchConfig.chunkSize, overlap = wikiSearchConfig.chunkOverlap): string[] => {
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
  if (!vectorStoreId || !vectorStoreId.startsWith('vs_')) {
    throw new Error(`Invalid Vector Store ID: ${vectorStoreId}`);
  }

  const uploadedFileIds: string[] = []; // Keep track of files successfully uploaded

  try {
    // 1. Upload each chunk as a temporary file to OpenAI
    const fileUploadPromises = chunks.map(async (chunk, index) => {
      const chunkFileName = `${fileName}_chunk_${index}.txt`;
      const chunkBuffer = Buffer.from(chunk, 'utf-8');

      try {
        const fileLike = await toFile(chunkBuffer, chunkFileName, { type: 'text/plain' });
        const fileObject = await openai.files.create({
          file: fileLike,
          purpose: 'assistants',
        });
        uploadedFileIds.push(fileObject.id); // Add to list only on successful upload
        return fileObject.id;
      } catch (_uploadError) {
        // Decide how to handle partial failures: throw immediately or collect errors?
        // For now, log and return null/undefined to filter out later
        return null;
      }
    });

    const maybeFileIds = await Promise.all(fileUploadPromises);
    const fileIds = maybeFileIds.filter((id): id is string => id !== null); // Filter out nulls from failed uploads

    if (fileIds.length === 0) {
      // Consider cleanup of potentially uploaded files if needed, though complex.
      throw new Error(`Failed to upload any chunks for ${fileName}.`);
    }

    // 2. Add these files to the Vector Store in a batch

    let batch: { id: string; status: string; file_counts?: { total?: number; in_progress?: number; completed?: number; failed?: number; cancelled?: number } };
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
        const deletePromises = uploadedFileIds.map(id =>
            openai.files.delete(id).catch(_delErr => {
                return null; // Silently handle errors
            })
        );
        await Promise.all(deletePromises);
        throw batchCreateError; 
    }
    // -----------------------------------------------

    // --- Detailed Logging of Batch Results --- 
    if (batch) {
      // ------------------------------------------

      if (batch.status !== 'completed' || (batch.file_counts?.failed || 0) > 0 || (batch.file_counts?.cancelled || 0) > 0) {
        // If some files failed, they are likely still in the Vector Store if the batch was partially processed.
        // If the whole batch failed/cancelled, the files might not be attached.
        // The files we uploaded earlier are *still* in the general OpenAI Files area unless deleted.
        // Consider logging the specific failed file IDs if the API provides them (might need listFiles method)
        // try {
        //     const batchFiles = await openai.beta.vectorStores.fileBatches.listFiles(vectorStoreId, batch.id);
        //     /* console.error("[storeChunks] Batch file details:", JSON.stringify(batchFiles.data, null, 2) */);
        // } catch (listError) {
        //     /* console.error("[storeChunks] Could not list files in failed batch:", listError) */;
        // }

        // Decide on error handling: Throw an error to signal failure back up the chain?
        throw new Error(`Vector Store batch processing failed for ${fileName}. Status: ${batch.status}, Failed: ${batch.file_counts?.failed || 0}, Cancelled: ${batch.file_counts?.cancelled || 0}`);
      } else {
      }
    } else {
      throw new Error(`Vector Store batch processing failed for ${fileName}. Batch object was not created successfully.`);
    }

  } catch (error) {
    // Log intermediate errors from upload/batching steps above
    // This catch block handles errors thrown explicitly or unexpected issues
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

    if (!vectorStoreId) {
      throw new Error("Vector Store ID is required for indexing.");
    }
    if (!openai) {
      throw new Error("OpenAI client is required for indexing.");
    }

    const chunks = chunkText(fileContent);

    if (!chunks || chunks.length === 0) {
      return;
    }

    // Store the chunks in the vector store
    await storeChunksInVectorStore(openai, vectorStoreId, chunks, fileName);

  } catch (error) {
    throw error; // Re-throw error
  }
}; 
/**
 * Speech Feedback Chunk Upload Route
 * 
 * This is the second step in the chunked upload pattern. After initializing a session,
 * the client uploads the audio file in chunks to this endpoint. Each chunk is stored
 * in memory and linked to the session.
 * 
 * CHUNKING STRATEGY:
 * - Client-side: File is split into chunks (typically 1-5MB each)
 * - Chunks are uploaded sequentially (not in parallel) to maintain order
 * - Each chunk includes its index for proper reassembly
 * - Final chunk is marked with a flag to indicate completion
 * 
 * WHY SEQUENTIAL UPLOADS?
 * - Simplifies reassembly logic (no need to handle out-of-order chunks)
 * - Reduces memory pressure on the server
 * - Makes progress tracking straightforward
 * - Easier error recovery (know exactly which chunk failed)
 * 
 * MEMORY MANAGEMENT:
 * - Chunks are stored in a Map keyed by sessionId and chunkIndex
 * - Total memory usage per session = file size + metadata overhead
 * - Sessions expire after 30 minutes to prevent memory leaks
 * - Serverless functions have ~3GB memory limit, supporting multiple concurrent uploads
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';

/**
 * Sanitize session ID to prevent directory traversal attacks
 * Even though we use in-memory storage, this prevents potential
 * security issues if the storage mechanism changes in the future
 */
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * POST /api/speech-feedback/chunk
 * 
 * Receives and stores individual chunks of the audio file upload
 * 
 * REQUEST (multipart/form-data):
 * - chunk: File          - The audio chunk data
 * - sessionId: string    - Session ID from the init step
 * - chunkIndex: string   - Zero-based index of this chunk
 * - finalChunk: string   - 'true' if this is the last chunk
 * 
 * RESPONSE:
 * {
 *   success: boolean
 *   message: string      - Human-readable status
 *   uploadedChunks: number - Total chunks received so far
 *   totalChunks: number    - Expected total chunks
 *   completed: boolean     - Whether all chunks are received
 * }
 * 
 * ERROR CASES:
 * - 400: Missing fields, invalid session ID, or invalid chunk index
 * - 404: Session not found (expired or never created)
 * - 413: Chunk exceeds size limit (security measure)
 * - 429: Rate limit exceeded
 * - 500: Server error storing chunk
 */
export async function POST(req: NextRequest) {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    try {
      // Parse the form data
      // We use FormData instead of JSON because we're receiving binary chunk data
      const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const sessionId = formData.get('sessionId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const finalChunk = formData.get('finalChunk') === 'true';

    // Validate required fields
    // All fields are critical for proper chunk storage and reassembly
    if (!chunk || !sessionId || isNaN(chunkIndex)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Security check: Sanitize session ID
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      // PRODUCTION: Logging disabled
// console.warn(`Potentially malicious session ID detected: ${sessionId}`);
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }
    
    // Validate chunk size (additional security check)
    // This prevents malicious uploads from consuming excessive memory
    // 10MB per chunk is generous - typical chunks are 1-5MB
    const maxChunkSize = 10 * 1024 * 1024; // 10MB max per chunk as a safety check
    if (chunk.size > maxChunkSize) {
      return NextResponse.json({ error: 'Chunk size exceeds maximum allowed' }, { status: 413 });
    }

    // Get session metadata
    // The session must exist (created in /init) before chunks can be uploaded
    const metadata = await UploadSessionStore.getSession(sanitizedSessionId);
    if (!metadata) {
      // Session might have expired (30min timeout) or never existed
      // PRODUCTION: Logging disabled
// console.log(`[chunk] Session not found: ${sanitizedSessionId}`);
      return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
    }

    // Check if this chunk index is valid
    // Prevents clients from uploading more chunks than declared
    if (chunkIndex >= metadata.totalChunks) {
      return NextResponse.json({ 
        error: `Invalid chunk index: ${chunkIndex}. Total chunks: ${metadata.totalChunks}` 
      }, { status: 400 });
    }

    // Save the chunk to memory store
    // Convert the File object to a Buffer for storage
    // The UploadSessionStore handles:
    // - Storing the chunk in the correct position
    // - Updating the uploadedChunks counter
    // - Preventing duplicate chunk uploads
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await UploadSessionStore.saveChunk(sanitizedSessionId, chunkIndex, chunkBuffer);

    // Update metadata if this is the final chunk
    // This flag helps the finalize endpoint know when to start processing
    if (finalChunk) {
      await UploadSessionStore.updateSession(sanitizedSessionId, { completed: true });
    }
    
    // Get updated metadata
    const updatedMetadata = await UploadSessionStore.getSession(sanitizedSessionId);

    // Return success response with updated metadata
    // This allows the client to track upload progress and verify completion
    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex} uploaded successfully`,
      uploadedChunks: updatedMetadata?.uploadedChunks || chunkIndex + 1,
      totalChunks: updatedMetadata?.totalChunks || metadata.totalChunks,
      completed: updatedMetadata?.completed || false
    });
  } catch (error) {
    // PRODUCTION: Logging disabled
// console.error('Error processing chunk upload:', error);
    
    // Don't expose internal errors to clients
    // Log the full error server-side for debugging
    return NextResponse.json({ 
      error: 'Failed to process chunk',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  });
} 
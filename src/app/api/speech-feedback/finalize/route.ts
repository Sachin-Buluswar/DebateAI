/**
 * Speech Feedback Finalization Route
 * 
 * This is the final step in the chunked upload pattern. After all chunks are uploaded,
 * the client calls this endpoint to trigger the processing of the complete audio file.
 * 
 * PROCESSING WORKFLOW:
 * 1. Validate all chunks have been received
 * 2. Reassemble chunks into complete audio file
 * 3. Invoke speech processing service directly (not via HTTP)
 * 4. Clean up the session from memory
 * 
 * SERVERLESS OPTIMIZATION:
 * Previous versions attempted to forward the reassembled file to another endpoint,
 * but this hit Vercel's 4.5MB request body limit. The current implementation
 * directly invokes the processing service, bypassing HTTP entirely.
 * 
 * AUDIO PROCESSING PIPELINE:
 * 1. Audio transcription via ElevenLabs Speech-to-Text
 * 2. AI analysis via OpenAI GPT-4 for feedback generation
 * 3. Results stored in Supabase for retrieval
 * 
 * ERROR RECOVERY:
 * - If processing fails, the session is cleaned up to free memory
 * - Clients can retry by starting a new upload session
 * - Partial uploads are not resumable (by design for simplicity)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';
import { processSpeechFeedback } from '@/backend/modules/speechFeedback/speechFeedbackService';

/**
 * Type definition for session metadata
 * Matches the structure created in the /init endpoint
 */
interface Metadata {
  contentType: string;
  filename: string;
  topic: string;
  speechType: string;
  userSide: string;
  customInstructions: string;
  userId: string;
  totalChunks: number;
  uploadedChunks: number;
  completed: boolean;
  totalSize: number;
}

/**
 * Sanitize session ID for security
 * Consistent with other endpoints in the upload flow
 */
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * [DEPRECATED] Forward the reassembled file to the main speech-feedback endpoint
 * 
 * This function is no longer used due to Vercel's 4.5MB request body limit.
 * Keeping it here for reference and potential future use with smaller files.
 * 
 * The function would create a FormData request and POST to /api/speech-feedback,
 * but this approach fails for files larger than 4.5MB on serverless platforms.
 * 
 * @deprecated Use direct service invocation instead
 */
// Forward the reassembled file to the main speech‑feedback endpoint using native FormData
async function forwardToMainEndpoint(sessionId: string, metadata: Metadata, fileBuffer: Buffer): Promise<Response> {
  try {
    // Use native FormData
    const form = new FormData();
    
    const fileBlob = new Blob([fileBuffer], { type: metadata.contentType || 'audio/mpeg' });
    form.append('audio', fileBlob, metadata.filename);
    
    // Append other metadata
    form.append('topic', metadata.topic);
    form.append('speechType', metadata.speechType || 'debate');
    form.append('userSide', metadata.userSide || 'None');
    form.append('customInstructions', metadata.customInstructions || '');
    form.append('userId', metadata.userId);

    // In production/serverless environments, we need to use the full URL
    // For local development, we can use relative URLs
    let targetUrl: string;
    
    // For Vercel deployments, use VERCEL_URL which is automatically provided
    if (process.env.VERCEL_URL) {
      targetUrl = `https://${process.env.VERCEL_URL}/api/speech-feedback`;
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      // Use configured app URL (for custom domains)
      targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/speech-feedback`;
    } else {
      // Local development fallback
      targetUrl = 'http://localhost:3001/api/speech-feedback';
    }

    console.log(`[finalize] Forwarding native FormData to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: form, // Pass native FormData directly
      headers: {
        // Forward any necessary headers but let fetch handle Content-Type for FormData
        'x-forwarded-for': 'internal-api-call',
      },
    });

    return response;
  } catch (error: unknown) {
    console.error('[finalize] Error forwarding to main endpoint:', error);
    throw error;
  }
}

/**
 * POST /api/speech-feedback/finalize
 * 
 * Finalizes the chunked upload and triggers audio processing
 * 
 * REQUEST BODY:
 * {
 *   sessionId: string - The session ID from the upload process
 * }
 * 
 * RESPONSE:
 * {
 *   id: string        - Feedback ID for retrieving results
 *   success: boolean  - Whether processing started successfully
 * }
 * 
 * PROCESSING STEPS:
 * 1. Retrieve session from memory store
 * 2. Validate all chunks were uploaded
 * 3. Merge chunks into complete audio buffer
 * 4. Invoke speech feedback service directly
 * 5. Clean up session from memory
 * 
 * ERROR CASES:
 * - 400: Missing session ID or incomplete upload
 * - 404: Session not found (expired or invalid)
 * - 500: Processing error or service failure
 */
export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    let sessionId: string | null = null; // Keep track of sessionId for error cleanup
    try {
      console.log('[finalize] Starting upload finalization');
      console.log('[finalize] Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        HAS_VERCEL_URL: !!process.env.VERCEL_URL,
        VERCEL_URL: process.env.VERCEL_URL?.substring(0, 20) + '...',
        HAS_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL
      });
      
      const data = await req.json() as { sessionId: string };
      sessionId = data.sessionId; // Assign sessionId here

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const sanitizedSessionId = sanitizeSessionId(sessionId);
    console.log(`[finalize] Checking session: ${sanitizedSessionId}`);
    
    // Get session metadata
    const metadata = await UploadSessionStore.getSession(sanitizedSessionId) as Metadata;
    if (!metadata) {
      console.error(`[finalize] Session not found: ${sanitizedSessionId}`);
      return NextResponse.json({ error: 'Upload session not found or expired' }, { status: 404 });
    }

    // Verify all chunks have been uploaded
    // This is critical - processing incomplete audio would fail or produce poor results
    if (metadata.uploadedChunks !== metadata.totalChunks) {
      console.warn(`Chunk mismatch for session ${sessionId}: expected ${metadata.totalChunks}, got ${metadata.uploadedChunks}`);
      return NextResponse.json({ 
        error: `Not all chunks uploaded. Received ${metadata.uploadedChunks} of ${metadata.totalChunks}` 
      }, { status: 400 });
    }

    console.log(`[finalize] Reassembling ${metadata.totalChunks} chunks for file ${metadata.filename} (size: ${metadata.totalSize})`);
    
    // Get merged buffer from memory store
    // The UploadSessionStore concatenates all chunks in order
    let fileBuffer: Buffer;
    try {
      fileBuffer = await UploadSessionStore.getMergedBuffer(sanitizedSessionId);
      console.log(`[finalize] Merged file size: ${fileBuffer.length} bytes`);
      
      // Sanity check: ensure we have data
      if (fileBuffer.length === 0) {
        throw new Error('Merged file is empty');
      }
      
      // Warn if size doesn't match (but continue - might be due to encoding)
      if (fileBuffer.length !== metadata.totalSize) {
        console.warn(`[finalize] Size mismatch - expected: ${metadata.totalSize}, actual: ${fileBuffer.length}`);
      }
    } catch (error) {
      console.error('[finalize] Error merging chunks:', error);
      throw new Error('Failed to merge uploaded chunks');
    }

    // =============================================================
    // CRITICAL: Direct service invocation for serverless compatibility
    // =============================================================
    //
    // WHY NOT HTTP?
    // Vercel (and most serverless providers) impose a ~4.5 MB body
    // limit on incoming requests. Re-posting the full audio file to a
    // second route would easily exceed that limit and trigger a 500.
    // 
    // SOLUTION:
    // Instead of making another HTTP request, we directly invoke the
    // underlying processing service. This bypasses the body size limit
    // entirely since we're passing data in-memory, not over HTTP.
    // 
    // BENEFITS:
    // - No body size limits
    // - Faster processing (no HTTP overhead)
    // - Better error handling (direct exceptions vs HTTP errors)
    // - Simpler architecture (fewer network hops)

    console.log('[finalize] Invoking processSpeechFeedback internally');

    const serviceResult = await processSpeechFeedback({
      audioBuffer: fileBuffer,
      filename: metadata.filename,
      mimeType: metadata.contentType || 'audio/mpeg',
      topic: metadata.topic,
      userId: metadata.userId,
      speechType: metadata.speechType,
      userSide: metadata.userSide,
      customInstructions: metadata.customInstructions,
    });

    // Clean up session from memory as we are done.
    // This is important to prevent memory leaks in long-running instances
    await UploadSessionStore.deleteSession(sanitizedSessionId);

    console.log('[finalize] Internal processing complete, returning');

    // Return the feedback ID so the client can retrieve results
    return NextResponse.json({
      id: serviceResult.feedbackId,
      success: true,
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[finalize] Error finalizing chunked upload:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HAS_VERCEL_URL: !!process.env.VERCEL_URL,
        HAS_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL
      }
    });
    
    // Clean up the session even if processing failed
    // This prevents memory leaks from failed uploads
    if (sessionId) {
      await UploadSessionStore.deleteSession(sanitizeSessionId(sessionId))
        .catch(err => console.error(`[finalize] Failed to clean up session on error:`, err));
    }
    
    // Don't expose internal error details in production
    // This prevents leaking sensitive information or implementation details
    const userError = process.env.NODE_ENV === 'production' 
      ? 'Failed to finalize upload' 
      : `Failed to finalize upload: ${errorMessage}`;
    
    return NextResponse.json({ error: userError }, { status: 500 });
  }
  });
}
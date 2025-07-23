import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';
import { processSpeechFeedback } from '@/backend/modules/speechFeedback/speechFeedbackService';

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

// Helper function to sanitize session ID to prevent directory traversal
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

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

    if (metadata.uploadedChunks !== metadata.totalChunks) {
      console.warn(`Chunk mismatch for session ${sessionId}: expected ${metadata.totalChunks}, got ${metadata.uploadedChunks}`);
      return NextResponse.json({ 
        error: `Not all chunks uploaded. Received ${metadata.uploadedChunks} of ${metadata.totalChunks}` 
      }, { status: 400 });
    }

    console.log(`[finalize] Reassembling ${metadata.totalChunks} chunks for file ${metadata.filename} (size: ${metadata.totalSize})`);
    
    // Get merged buffer from memory store
    let fileBuffer: Buffer;
    try {
      fileBuffer = await UploadSessionStore.getMergedBuffer(sanitizedSessionId);
      console.log(`[finalize] Merged file size: ${fileBuffer.length} bytes`);
      
      if (fileBuffer.length === 0) {
        throw new Error('Merged file is empty');
      }
      
      if (fileBuffer.length !== metadata.totalSize) {
        console.warn(`[finalize] Size mismatch - expected: ${metadata.totalSize}, actual: ${fileBuffer.length}`);
      }
    } catch (error) {
      console.error('[finalize] Error merging chunks:', error);
      throw new Error('Failed to merge uploaded chunks');
    }

    // =============================================================
    // NEW: Directly call the processing service in serverless envs
    // =============================================================

    // Vercel (and most serverless providers) impose a ~4.5 MB body
    // limit on incoming requests. Re-posting the full audio file to a
    // second route would easily exceed that limit and trigger a 500.
    // Instead, we now invoke the underlying processing service
    // directly, bypassing the extra HTTP hop entirely.

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
    await UploadSessionStore.deleteSession(sanitizedSessionId);

    console.log('[finalize] Internal processing complete, returning');

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
    
    if (sessionId) {
      await UploadSessionStore.deleteSession(sanitizeSessionId(sessionId))
        .catch(err => console.error(`[finalize] Failed to clean up session on error:`, err));
    }
    
    // Don't expose internal error details in production
    const userError = process.env.NODE_ENV === 'production' 
      ? 'Failed to finalize upload' 
      : `Failed to finalize upload: ${errorMessage}`;
    
    return NextResponse.json({ error: userError }, { status: 500 });
  }
  });
}
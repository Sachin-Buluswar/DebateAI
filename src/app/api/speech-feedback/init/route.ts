import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';

// Helper function to sanitize session ID to prevent directory traversal
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}


export async function POST(req: NextRequest) {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    try {
      console.log('[init] Starting upload session initialization');

    // Parse the request body
    const data = await req.json();
    const { 
      filename, 
      contentType, 
      totalSize, 
      totalChunks, 
      sessionId,
      userId,
      topic, 
      speechType, 
      userSide,
      customInstructions
    } = data;

    // Validate required fields
    if (!filename || !contentType || !totalSize || !totalChunks || !sessionId || !userId || !topic || !speechType || !userSide) {
      // Custom instructions are optional, so not validated here
      return NextResponse.json({ error: 'Missing required fields for init' }, { status: 400 });
    }

    // Sanitize session ID
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      console.warn(`[init] Invalid session ID format: ${sessionId}`);
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // Create session metadata
    const metadata = {
      filename,
      contentType,
      totalSize,
      totalChunks,
      userId,
      topic: topic || '',
      speechType: speechType || 'debate',
      userSide: userSide || 'None',
      customInstructions: customInstructions || '',
      uploadedChunks: 0,
      completed: false
    };

    // Store session in memory
    await UploadSessionStore.createSession(sanitizedSessionId, metadata);

    // Return success response with session ID
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Upload session initialized'
    });
  } catch (error) {
    console.error('Error initializing chunked upload:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize upload session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  });
} 
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';

// Helper function to sanitize session ID to prevent directory traversal
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

export async function DELETE(req: NextRequest) {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    try {
      // Get the session ID from the URL
      const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }
    
    // Sanitize session ID to prevent directory traversal
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      console.warn(`Potentially malicious session ID detected during cancel: ${sessionId}`);
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // Check if session exists
    const exists = UploadSessionStore.sessionExists(sanitizedSessionId);
    if (!exists) {
      // Session doesn't exist, but we consider this a success
      return NextResponse.json({ 
        success: true,
        message: 'Upload session not found'
      });
    }

    // Delete the session from memory
    await UploadSessionStore.deleteSession(sanitizedSessionId);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Upload session cancelled'
    });
  } catch (error) {
    console.error('Error cancelling upload session:', error);
    return NextResponse.json({ 
      error: 'Failed to cancel upload session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  });
} 
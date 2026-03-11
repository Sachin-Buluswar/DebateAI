/**
 * Speech Feedback Upload Cancellation Route
 * 
 * This endpoint allows clients to cancel an in-progress upload and clean up resources.
 * It's important for preventing memory leaks when users abandon uploads.
 * 
 * USE CASES:
 * - User navigates away during upload
 * - Upload errors that can't be recovered
 * - User explicitly cancels the upload
 * - Client-side timeout or network failure
 * 
 * CLEANUP STRATEGY:
 * - Immediately removes session from memory
 * - Frees all stored chunks
 * - Idempotent - safe to call multiple times
 * - Returns success even if session doesn't exist
 * 
 * MEMORY MANAGEMENT:
 * While sessions auto-expire after 30 minutes, explicit cancellation
 * ensures immediate cleanup, which is important for:
 * - Large files that consume significant memory
 * - High-traffic scenarios where memory is constrained
 * - Good user experience (immediate resource release)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/api-middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { UploadSessionStore } from '@/lib/uploadSessionStore';

/**
 * Sanitize session ID to prevent potential security issues
 * Maintains consistency with other endpoints in the upload flow
 */
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * DELETE /api/speech-feedback/cancel?sessionId={id}
 * 
 * Cancels an upload session and cleans up all associated resources
 * 
 * QUERY PARAMETERS:
 * - sessionId: string - The session ID to cancel
 * 
 * RESPONSE:
 * {
 *   success: boolean
 *   message: string - Human-readable status
 * }
 * 
 * DESIGN DECISIONS:
 * - Uses DELETE method as we're removing a resource
 * - Query parameter instead of body for REST compliance
 * - Idempotent - multiple calls have same effect
 * - Always returns success (even if session doesn't exist)
 * 
 * ERROR CASES:
 * - 400: Missing or invalid session ID format
 * - 429: Rate limit exceeded
 * - 500: Server error during cleanup (rare)
 */
export async function DELETE(req: NextRequest) {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    return requireAuth(req, async (_authenticatedReq: AuthenticatedRequest) => {
    try {
      // Get the session ID from the URL query parameters
      // Using query params for DELETE requests is RESTful
      const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }
    
    // Sanitize session ID to prevent directory traversal
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // Check if session exists
    const exists = UploadSessionStore.sessionExists(sanitizedSessionId);
    if (!exists) {
      // Session doesn't exist, but we consider this a success
      // This makes the operation idempotent - calling cancel
      // multiple times or on non-existent sessions is safe
      return NextResponse.json({ 
        success: true,
        message: 'Upload session not found'
      });
    }

    // Delete the session from memory
    // This operation:
    // - Removes session metadata
    // - Deletes all stored chunks
    // - Frees memory immediately
    await UploadSessionStore.deleteSession(sanitizedSessionId);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Upload session cancelled'
    });
  } catch (_error) {
    // Return error response
    // Cancellation errors are rare but could indicate memory issues
    return NextResponse.json({
      error: 'Failed to cancel upload session'
    }, { status: 500 });
  }
    });
  });
} 
/**
 * Speech Feedback Upload Initialization Route
 * 
 * This is the first step in the chunked upload pattern for speech feedback audio files.
 * We use chunked uploads to handle large audio files (up to 100MB) in a serverless environment
 * where request timeouts and body size limits are constraints.
 * 
 * WORKFLOW:
 * 1. Client initiates upload with metadata (filename, size, chunk count)
 * 2. Server creates an in-memory session to track the upload progress
 * 3. Client uploads chunks sequentially to /chunk endpoint
 * 4. Client calls /finalize to trigger processing
 * 
 * WHY CHUNKED UPLOADS?
 * - Serverless platforms (Vercel) have a 4.5MB body size limit
 * - Large audio files would timeout or fail with traditional single-request uploads
 * - Chunking allows progress tracking and resumable uploads
 * - Better error recovery - only failed chunks need to be retried
 * 
 * SESSION MANAGEMENT:
 * - Sessions are stored in-memory using UploadSessionStore
 * - Each session has a unique ID and tracks upload metadata
 * - Sessions expire after 30 minutes of inactivity
 * - In-memory storage works because each upload completes within a single serverless instance lifecycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';
import { addSecurityHeaders } from '@/middleware/inputValidation';

/**
 * Sanitize session ID to prevent directory traversal attacks
 * 
 * Security consideration: Even though we use in-memory storage,
 * we sanitize IDs to establish good security practices and prevent
 * potential issues if storage mechanism changes in the future.
 * 
 * @param sessionId - Raw session ID from client
 * @returns Sanitized session ID containing only safe characters
 */
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}


/**
 * POST /api/speech-feedback/init
 * 
 * Initializes a new chunked upload session for speech feedback audio
 * 
 * REQUEST BODY:
 * {
 *   sessionId: string      - Unique ID for this upload session (client-generated)
 *   filename: string       - Original filename of the audio file
 *   contentType: string    - MIME type (e.g., 'audio/mpeg', 'audio/wav')
 *   totalSize: number      - Total file size in bytes
 *   totalChunks: number    - Number of chunks the file will be split into
 *   userId: string         - ID of the user uploading the file
 *   topic: string          - Debate topic for context
 *   speechType: string     - Type of speech ('debate', 'practice', etc.)
 *   userSide: string       - Which side of the debate ('For', 'Against', 'None')
 *   customInstructions?: string - Optional custom feedback instructions
 * }
 * 
 * RESPONSE:
 * {
 *   success: boolean
 *   sessionId: string      - Echo back the session ID for confirmation
 *   message: string        - Human-readable status message
 * }
 * 
 * ERROR HANDLING:
 * - 400: Missing required fields or invalid session ID format
 * - 429: Rate limit exceeded (handled by middleware)
 * - 500: Server error creating session
 */
export async function POST(req: NextRequest) {
  // Apply rate limiting specifically for speech feedback uploads
  // This prevents abuse and ensures fair resource usage
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    try {
      // Check authentication first
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Unauthorized - Please log in to upload speech' },
            { status: 401 }
          )
        );
      }
      
      // PRODUCTION: Logging disabled
// console.log('[init] Starting upload session initialization');

      // Parse the request body
      const data = await req.json();
      const { 
        filename, 
        contentType, 
        totalSize, 
        totalChunks, 
        sessionId,
        topic, 
        speechType, 
        userSide,
        skillLevel,
        customInstructions
      } = data;
      
      // Use authenticated user's ID, not client-provided
      const userId = user.id;

      // Validate required fields
      // These fields are essential for:
      // - filename/contentType: Proper file handling and type validation
      // - totalSize/totalChunks: Tracking upload progress and validation
      // - sessionId: Linking chunks to the correct upload session
      // - topic/speechType/userSide: Context for AI feedback generation
      if (!filename || !contentType || !totalSize || !totalChunks || !sessionId || !topic || !speechType || !userSide) {
        // Custom instructions are optional, so not validated here
        return addSecurityHeaders(
          NextResponse.json({ error: 'Missing required fields for init' }, { status: 400 })
        );
      }

      // Sanitize session ID
      const sanitizedSessionId = sanitizeSessionId(sessionId);
      if (sanitizedSessionId !== sessionId) {
        // PRODUCTION: Logging disabled
// console.warn(`[init] Invalid session ID format: ${sessionId}`);
        return addSecurityHeaders(
          NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 })
        );
      }

    // Create session metadata
    // This metadata object tracks everything needed to:
    // 1. Reassemble the file from chunks
    // 2. Validate the upload integrity
    // 3. Provide context for AI processing
    // 4. Track upload progress
    const metadata = {
      filename,
      contentType,
      totalSize,
      totalChunks,
      userId,
      topic: topic || '',
      speechType: speechType || 'debate',
      userSide: userSide || 'None',
      skillLevel: skillLevel || 'intermediate',
      customInstructions: customInstructions || '',
      uploadedChunks: 0,         // Tracks how many chunks have been received
      completed: false           // Flag to indicate if upload is finalized
    };

    // Store session in memory
    // The UploadSessionStore uses an in-memory Map to store sessions
    // This is suitable for serverless because:
    // - Each upload completes within minutes (not hours)
    // - The entire upload process happens on a single instance
    // - Sessions auto-expire after 30 minutes to prevent memory leaks
    await UploadSessionStore.createSession(sanitizedSessionId, metadata);

      // Return success response with session ID
      // Client will use this sessionId for all subsequent chunk uploads
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          sessionId,
          message: 'Upload session initialized'
        })
      );
    } catch (error) {
      // Log the full error for debugging
      // PRODUCTION: Logging disabled
// console.error('Error initializing chunked upload:', error);
      
      // Return a sanitized error response
      // In production, we don't expose internal error details
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Failed to initialize upload session',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      );
  }
  });
} 
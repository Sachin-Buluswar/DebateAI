/**
 * Speech Feedback Finalization Route
 *
 * Final step in the chunked upload pattern. After all chunks are uploaded,
 * the client calls this endpoint to trigger processing of the complete audio file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';
import { processSpeechFeedback } from '@/backend/modules/speechFeedback/speechFeedbackService';
import { addSecurityHeaders } from '@/middleware/inputValidation';

interface Metadata {
  contentType: string;
  filename: string;
  topic: string;
  speechType: string;
  userSide: string;
  skillLevel: string;
  customInstructions: string;
  userId: string;
  totalChunks: number;
  uploadedChunks: number;
  completed: boolean;
  totalSize: number;
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    return requireAuth(req, async (_authenticatedRequest: AuthenticatedRequest) => {
    let sessionId: string | null = null;
    try {
      const data = await req.json() as { sessionId: string };
      sessionId = data.sessionId;

      if (!sessionId) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
        );
      }

    const sanitizedSessionId = sanitizeSessionId(sessionId);

    // Get session metadata
    const metadata = await UploadSessionStore.getSession(sanitizedSessionId) as Metadata;
    if (!metadata) {
      return NextResponse.json({ error: 'Upload session not found or expired' }, { status: 404 });
    }

    // Verify all chunks have been uploaded
    if (metadata.uploadedChunks !== metadata.totalChunks) {
      return NextResponse.json({
        error: `Not all chunks uploaded. Received ${metadata.uploadedChunks} of ${metadata.totalChunks}`
      }, { status: 400 });
    }

    // Get merged buffer from memory store
    let fileBuffer: Buffer;
    try {
      fileBuffer = await UploadSessionStore.getMergedBuffer(sanitizedSessionId);

      if (fileBuffer.length === 0) {
        throw new Error('Merged file is empty');
      }
    } catch (_error) {
      throw new Error('Failed to merge uploaded chunks');
    }

    // Direct service invocation for serverless compatibility
    // Bypasses Vercel's 4.5MB request body limit by passing data in-memory
    const serviceResult = await processSpeechFeedback({
      audioBuffer: fileBuffer,
      filename: metadata.filename,
      mimeType: metadata.contentType || 'audio/mpeg',
      topic: metadata.topic,
      userId: metadata.userId,
      speechType: metadata.speechType,
      userSide: metadata.userSide,
      skillLevel: (metadata.skillLevel as 'novice' | 'intermediate' | 'advanced') || 'intermediate',
      customInstructions: metadata.customInstructions,
    });

    // Clean up session from memory
    await UploadSessionStore.deleteSession(sanitizedSessionId);

    return NextResponse.json({
      id: serviceResult.feedbackId,
      success: true,
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    // Clean up the session even if processing failed
    if (sessionId) {
      await UploadSessionStore.deleteSession(sanitizeSessionId(sessionId))
        .catch(() => {
          // Silently handle cleanup failure
        });
    }

    const userError = process.env.NODE_ENV === 'production'
      ? 'Failed to finalize upload'
      : `Failed to finalize upload: ${errorMessage}`;

    return NextResponse.json({ error: userError }, { status: 500 });
  }
    });
  });
}

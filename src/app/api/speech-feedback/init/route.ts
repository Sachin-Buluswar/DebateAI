/**
 * Speech Feedback Upload Initialization Route
 *
 * First step in the chunked upload pattern for speech feedback audio files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { withRateLimit, speechFeedbackRateLimiter } from '@/api-middleware/rateLimiter';
import { UploadSessionStore } from '@/lib/uploadSessionStore';
import { addSecurityHeaders } from '@/api-middleware/inputValidation';

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

export async function POST(req: NextRequest) {
  return await withRateLimit(req, speechFeedbackRateLimiter, async () => {
    return requireAuth(req, async (authenticatedRequest: AuthenticatedRequest) => {
      try {
        const user = authenticatedRequest.user;

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
          customInstructions,
        } = data;

        // Use authenticated user's ID, not client-provided
        const userId = user.id;

        // Validate required fields
        if (
          !filename ||
          !contentType ||
          !totalSize ||
          !totalChunks ||
          !sessionId ||
          !topic ||
          !speechType ||
          !userSide
        ) {
          return addSecurityHeaders(
            NextResponse.json({ error: 'Missing required fields for init' }, { status: 400 })
          );
        }

        // Sanitize session ID
        const sanitizedSessionId = sanitizeSessionId(sessionId);
        if (sanitizedSessionId !== sessionId) {
          return addSecurityHeaders(
            NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 })
          );
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
          skillLevel: skillLevel || 'intermediate',
          customInstructions: customInstructions || '',
          uploadedChunks: 0,
          completed: false,
        };

        // Store session in memory
        await UploadSessionStore.createSession(sanitizedSessionId, metadata);

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            sessionId,
            message: 'Upload session initialized',
          })
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Failed to initialize upload session',
            },
            { status: 500 }
          )
        );
      }
    });
  });
}

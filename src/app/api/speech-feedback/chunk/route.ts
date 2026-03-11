/**
 * Speech Feedback Chunk Upload Route
 *
 * Second step in the chunked upload pattern. After initializing a session,
 * the client uploads audio file chunks to this endpoint.
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

      // Parse the form data
      const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const sessionId = formData.get('sessionId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const finalChunk = formData.get('finalChunk') === 'true';

    // Validate required fields
    if (!chunk || !sessionId || isNaN(chunkIndex)) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      );
    }

    // Security check: Sanitize session ID
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 })
      );
    }

    // Validate chunk size (10MB max per chunk)
    const maxChunkSize = 10 * 1024 * 1024;
    if (chunk.size > maxChunkSize) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Chunk size exceeds maximum allowed' }, { status: 413 })
      );
    }

    // Get session metadata
    const metadata = await UploadSessionStore.getSession(sanitizedSessionId);
    if (!metadata) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Upload session not found' }, { status: 404 })
      );
    }

    // Verify the session belongs to the authenticated user
    if (metadata.userId !== user.id) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized - Session does not belong to you' }, { status: 403 })
      );
    }

    // Check if this chunk index is valid
    if (chunkIndex >= metadata.totalChunks) {
      return addSecurityHeaders(
        NextResponse.json({
          error: `Invalid chunk index: ${chunkIndex}. Total chunks: ${metadata.totalChunks}`
        }, { status: 400 })
      );
    }

    // Save the chunk to memory store
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await UploadSessionStore.saveChunk(sanitizedSessionId, chunkIndex, chunkBuffer);

    // Update metadata if this is the final chunk
    if (finalChunk) {
      await UploadSessionStore.updateSession(sanitizedSessionId, { completed: true });
    }

    // Get updated metadata
    const updatedMetadata = await UploadSessionStore.getSession(sanitizedSessionId);

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: `Chunk ${chunkIndex} uploaded successfully`,
        uploadedChunks: updatedMetadata?.uploadedChunks || chunkIndex + 1,
        totalChunks: updatedMetadata?.totalChunks || metadata.totalChunks,
        completed: updatedMetadata?.completed || false
      })
    );
  } catch (_error) {
    return addSecurityHeaders(
      NextResponse.json({
        error: 'Failed to process chunk'
      }, { status: 500 })
    );
  }
    });
  });
}

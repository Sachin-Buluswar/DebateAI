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
      // Parse the form data
      const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const sessionId = formData.get('sessionId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const finalChunk = formData.get('finalChunk') === 'true';

    // Validate required fields
    if (!chunk || !sessionId || isNaN(chunkIndex)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Security check: Sanitize session ID
    const sanitizedSessionId = sanitizeSessionId(sessionId);
    if (sanitizedSessionId !== sessionId) {
      console.warn(`Potentially malicious session ID detected: ${sessionId}`);
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }
    
    // Validate chunk size (additional security check)
    const maxChunkSize = 10 * 1024 * 1024; // 10MB max per chunk as a safety check
    if (chunk.size > maxChunkSize) {
      return NextResponse.json({ error: 'Chunk size exceeds maximum allowed' }, { status: 413 });
    }

    // Get session metadata
    const metadata = await UploadSessionStore.getSession(sanitizedSessionId);
    if (!metadata) {
      console.log(`[chunk] Session not found: ${sanitizedSessionId}`);
      return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
    }

    // Check if this chunk index is valid
    if (chunkIndex >= metadata.totalChunks) {
      return NextResponse.json({ 
        error: `Invalid chunk index: ${chunkIndex}. Total chunks: ${metadata.totalChunks}` 
      }, { status: 400 });
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

    // Return success response with updated metadata
    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex} uploaded successfully`,
      uploadedChunks: updatedMetadata?.uploadedChunks || chunkIndex + 1,
      totalChunks: updatedMetadata?.totalChunks || metadata.totalChunks,
      completed: updatedMetadata?.completed || false
    });
  } catch (error) {
    console.error('Error processing chunk upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process chunk',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
  });
} 
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';

// Temporary directory to store chunks
// Using a more specific path that's guaranteed to be writable
const TEMP_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp/chunked_uploads'  // Vercel/serverless environments
  : path.join(process.cwd(), '.tmp', 'chunked_uploads'); // Local development

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

    // Check if session directory exists
    const sessionDir = path.join(TEMP_DIR, sanitizedSessionId);
    try {
      await fs.access(sessionDir);
    } catch {
      return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
    }

    // Read session metadata
    const metadataPath = path.join(sessionDir, 'metadata.json');
    const metadataJson = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataJson);

    // Check if this chunk index is valid
    if (chunkIndex >= metadata.totalChunks) {
      return NextResponse.json({ 
        error: `Invalid chunk index: ${chunkIndex}. Total chunks: ${metadata.totalChunks}` 
      }, { status: 400 });
    }

    // Save the chunk to disk
    const chunkPath = path.join(sessionDir, `chunk-${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(chunkPath, chunkBuffer);

    // Update metadata
    metadata.uploadedChunks += 1;
    if (finalChunk) {
      metadata.completed = true;
    }
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex} uploaded successfully`,
      uploadedChunks: metadata.uploadedChunks,
      totalChunks: metadata.totalChunks,
      completed: metadata.completed
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
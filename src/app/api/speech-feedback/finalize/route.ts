import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, createWriteStream, createReadStream, ReadStream, WriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { withRateLimit, speechFeedbackRateLimiter } from '@/middleware/rateLimiter';

// Temporary directory to store chunks
// Using a more specific path that's guaranteed to be writable
const TEMP_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp/chunked_uploads'  // Vercel/serverless environments
  : path.join(process.cwd(), '.tmp', 'chunked_uploads'); // Local development

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
async function forwardStreamToMainEndpoint(sessionId: string, metadata: Metadata, filePath: string): Promise<Response> {
  let fileStream: ReadStream | null = null;
  try {
    fileStream = createReadStream(filePath);

    // Use native FormData
    const form = new FormData();
    
    // Append the stream as a File object
    // We need to read the stream into a blob/buffer first for native FormData
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      fileStream!.on('data', chunk => {
        // Handle both string and Buffer chunks
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk as string));
        }
      });
      fileStream!.on('error', reject);
      fileStream!.on('end', () => resolve(Buffer.concat(chunks)));
    });
    
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
    console.error('Error forwarding native FormData to main endpoint:', error);
    // Ensure stream is destroyed on error if it exists and has a destroy method
    if (fileStream && typeof fileStream.destroy === 'function') {
        fileStream.destroy();
    }
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

    const sessionDir = path.join(TEMP_DIR, sanitizeSessionId(sessionId));
    console.log(`[finalize] Checking session directory: ${sessionDir}`);
    
    try {
      // Check if directory exists and is readable
      const stats = await fs.stat(sessionDir);
      if (!stats.isDirectory()) {
        throw new Error('Session path is not a directory');
      }
    } catch (error) {
      console.error(`[finalize] Session directory not found or inaccessible: ${sessionDir}`, error);
      
      // List contents of parent directory for debugging
      try {
        const parentDir = path.dirname(sessionDir);
        const contents = await fs.readdir(parentDir);
        console.log(`[finalize] Parent directory contents (${parentDir}):`, contents);
      } catch (listError) {
        console.error('[finalize] Could not list parent directory:', listError);
      }
      
      return NextResponse.json({ error: 'Upload session not found or inaccessible' }, { status: 404 });
    }

    const metadataPath = path.join(sessionDir, 'metadata.json');
    let metadata: Metadata;
    try {
        const metadataJson = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataJson) as Metadata;
    } catch (error) {
        console.error(`Failed to read or parse metadata file: ${metadataPath}`, error);
        return NextResponse.json({ error: 'Failed to read session metadata' }, { status: 500 });
    }

    if (metadata.uploadedChunks !== metadata.totalChunks) {
      console.warn(`Chunk mismatch for session ${sessionId}: expected ${metadata.totalChunks}, got ${metadata.uploadedChunks}`);
      return NextResponse.json({ 
        error: `Not all chunks uploaded. Received ${metadata.uploadedChunks} of ${metadata.totalChunks}` 
      }, { status: 400 });
    }

    const mergedFilePath = path.join(sessionDir, 'complete-file');
    let writeStream: WriteStream | null = null;
    try {
      writeStream = createWriteStream(mergedFilePath);
      // Increase max listeners significantly to prevent warning during chunk processing
      writeStream.setMaxListeners(100); // Set a higher fixed limit 
      
      console.log(`Reassembling ${metadata.totalChunks} chunks for file ${metadata.filename} (size: ${metadata.totalSize})`);
      
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk-${i}`);
        let readStream: ReadStream | null = null;
        try {
          readStream = createReadStream(chunkPath);
          // Use pipeline for better error handling and cleanup
          await pipeline(readStream, writeStream!, { end: false }); 
          if (i % 10 === 0 || i === metadata.totalChunks - 1) {
            console.log(`Reassembled chunk ${i + 1}/${metadata.totalChunks}`);
          }
        } finally {
          // Pipeline handles stream destruction on error/completion
        }
      }

      // Finalize the write stream (ensure all data is flushed)
      await new Promise<void>((resolve, reject) => {
        writeStream!.end((err: NodeJS.ErrnoException | null) => {
          if (err) reject(err); else resolve();
        });
      });

    } finally {
      if (writeStream && !writeStream.closed) {
        writeStream.close();
      }
    }

    console.log(`[finalize] File reassembly complete: ${mergedFilePath}`);
    
    // Verify the merged file exists and has content
    try {
      const mergedStats = await fs.stat(mergedFilePath);
      console.log(`[finalize] Merged file size: ${mergedStats.size} bytes`);
      if (mergedStats.size === 0) {
        throw new Error('Merged file is empty');
      }
    } catch (error) {
      console.error('[finalize] Error verifying merged file:', error);
      throw new Error('Failed to verify merged file');
    }

    // Forward the merged file to the main speech-feedback endpoint
    console.log('[finalize] Forwarding to main speech-feedback endpoint');
    const response = await forwardStreamToMainEndpoint(sessionId, metadata, mergedFilePath);

    console.log(`Response from main endpoint: status=${response.status}`);

    // Clean up
    fs.rm(sessionDir, { recursive: true, force: true })
      .then(() => console.log(`Cleaned up session directory ${sessionDir}`))
      .catch(err => console.error(`Failed to clean up session directory ${sessionDir}:`, err));

    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      console.error('[finalize] Failed to parse response JSON:', jsonError);
      const responseText = await response.text();
      console.error('[finalize] Response text:', responseText);
      throw new Error('Invalid response from speech feedback endpoint');
    }
    
    console.log('[finalize] Success, returning response');
    return NextResponse.json(responseData, { status: response.status });

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
      const sessionDir = path.join(TEMP_DIR, sanitizeSessionId(sessionId));
      fs.rm(sessionDir, { recursive: true, force: true })
        .catch(err => console.error(`[finalize] Failed to clean up session directory ${sessionDir} on error:`, err));
    }
    
    // Don't expose internal error details in production
    const userError = process.env.NODE_ENV === 'production' 
      ? 'Failed to finalize upload' 
      : `Failed to finalize upload: ${errorMessage}`;
    
    return NextResponse.json({ error: userError }, { status: 500 });
  }
  });
}
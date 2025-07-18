import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Temporary directory to store chunks
const TEMP_DIR = '/tmp/chunked_uploads';

// Helper function to sanitize session ID to prevent directory traversal
function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  return sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
}

// Make sure temp directory exists
async function ensureTempDirExists() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating temp directory:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Ensure temp directory exists
    const tempDirExists = await ensureTempDirExists();
    if (!tempDirExists) {
      return NextResponse.json({ error: 'Failed to create temporary directory' }, { status: 500 });
    }

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

    // Create a session directory for this upload
    const sessionDir = path.join(TEMP_DIR, sanitizeSessionId(sessionId));
    await fs.mkdir(sessionDir, { recursive: true });

    // Create a metadata file with information about the upload
    const metadata = {
      filename,
      contentType,
      totalSize,
      totalChunks,
      sessionId,
      userId,
      topic: topic || '',
      speechType: speechType || 'debate',
      userSide: userSide || 'None',
      customInstructions: customInstructions || '',
      uploadedChunks: 0,
      createdAt: new Date().toISOString(),
      completed: false
    };

    // Write metadata to file
    await fs.writeFile(
      path.join(sessionDir, 'metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );

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
} 
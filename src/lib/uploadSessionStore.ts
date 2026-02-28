/**
 * Upload Session Store for Serverless Environments
 * Uses Supabase to store upload sessions and chunks
 */

// Note: Supabase client removed - upload sessions use in-memory storage only

interface SessionMetadata {
  filename: string;
  contentType: string;
  totalSize: number;
  totalChunks: number;
  userId: string;
  topic: string;
  speechType: string;
  userSide: string;
  customInstructions: string;
  uploadedChunks: number;
  completed: boolean;
}

export class UploadSessionStore {
  // Store session metadata in memory with expiration
  private static sessions = new Map<string, {
    metadata: SessionMetadata;
    chunks: Map<number, Buffer>;
    createdAt: number;
  }>();

  // Clean up old sessions every 5 minutes
  private static cleanupInterval = setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.createdAt < oneHourAgo) {
        this.sessions.delete(sessionId);
      }
    }
  }, 5 * 60 * 1000);

  static async createSession(sessionId: string, metadata: SessionMetadata): Promise<void> {
    this.sessions.set(sessionId, {
      metadata,
      chunks: new Map(),
      createdAt: Date.now()
    });
  }

  static async getSession(sessionId: string): Promise<SessionMetadata | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return session.metadata;
  }

  static async saveChunk(sessionId: string, chunkIndex: number, data: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.chunks.set(chunkIndex, data);
    session.metadata.uploadedChunks = session.chunks.size;
    
    
  }

  static async updateSession(sessionId: string, updates: Partial<SessionMetadata>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.metadata = { ...session.metadata, ...updates };
  }

  static async getMergedBuffer(sessionId: string): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { metadata, chunks } = session;
    
    // Verify all chunks are present
    if (chunks.size !== metadata.totalChunks) {
      throw new Error(`Missing chunks: expected ${metadata.totalChunks}, got ${chunks.size}`);
    }

    // Merge chunks in order
    const buffers: Buffer[] = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      buffers.push(chunk);
    }

    return Buffer.concat(buffers);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  static sessionExists(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
/**
 * @file src/app/api/debate/speech/route.ts
 * @description API endpoint to save individual speeches during a debate
 * 
 * This endpoint persists speech content from debate participants (both human and AI)
 * to the database for later analysis and playback. Each speech is linked to:
 * - The debate session it belongs to
 * - The speaker who delivered it
 * - The side they're arguing (PRO/CON)
 * - Timestamp for chronological ordering
 * 
 * Flow:
 * 1. Participant speaks in debate (via voice or text)
 * 2. Speech is transcribed/captured
 * 3. Frontend sends speech data to this endpoint
 * 4. Speech is saved to database
 * 5. Session activity is updated
 * 
 * Related files:
 * - src/app/api/debate/analyze/route.ts - Uses saved speeches for analysis
 * - src/backend/services/elevenLabsWebSocket.ts - Voice transcription
 * - src/components/debate/DebateInterface.tsx - Frontend speech capture
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

// Initialize Supabase admin client
// Service role key needed to bypass RLS and save speeches from any participant
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin access for speech persistence
);

// Request validation schema for speech data
const speechSchema = z.object({
  sessionId: z.string().uuid(), // Links speech to debate session
  speakerId: z.string().uuid(), // ID of speaker (user or AI participant)
  text: z.string().min(1).max(5000), // Speech content with reasonable limits
  side: z.enum(['PRO', 'CON']), // Which side the speaker represents
  timestamp: z.string().datetime().optional(), // Optional ISO timestamp (defaults to now)
});

/**
 * POST /api/debate/speech
 * 
 * Saves a speech from a debate participant
 * 
 * Request body:
 * {
 *   sessionId: string (UUID) - ID of the active debate session
 *   speakerId: string (UUID) - ID of the speaker (user or AI)
 *   text: string (1-5000 chars) - The speech content/transcript
 *   side: 'PRO' | 'CON' - Which side the speaker is arguing
 *   timestamp?: string (ISO datetime) - When speech was delivered
 * }
 * 
 * Response:
 * Success (200): { success: true, speechId: string, message: string }
 * Error (400): { error: 'Invalid request' }
 * Error (500): { error: 'Failed to save speech' }
 * 
 * Side effects:
 * - Updates debate session last_activity timestamp
 * - Increments session speech_count (if RPC function exists)
 * 
 * Note: No authentication check - relies on valid session/speaker IDs
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent speech spam
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const body = await request.json();
      const validated = speechSchema.parse(body);

      // Save speech to database
      // Each speech is a permanent record for analysis and replay
      const { data: speech, error } = await supabase
        .from('speeches')
        .insert({
          session_id: validated.sessionId, // Foreign key to debate_sessions
          speaker_id: validated.speakerId, // Foreign key to users or AI participants
          content: validated.text, // The actual speech text/transcript
          side: validated.side, // PRO or CON position
          timestamp: validated.timestamp || new Date().toISOString(), // Default to current time
        })
        .select() // Return the created record
        .single(); // Expect single result

      if (error) {
        // PRODUCTION: Logging disabled
// console.error('Error saving speech:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to save speech' },
            { status: 500 }
          )
        );
      }

      // Update debate session last activity
      // This helps track active sessions and detect timeouts
      // Note: speech_count increment uses Supabase RPC function (if defined)
      await supabase
        .from('debate_sessions')
        .update({ 
          last_activity: new Date().toISOString(), // Track when last speech occurred
          speech_count: supabase.rpc('increment', { x: 1 }) // Increment counter (requires RPC)
        })
        .eq('id', validated.sessionId); // Update only this session

      // Return success with speech ID
      // Frontend can use speechId to:
      // - Display confirmation
      // - Reference in future operations
      // - Track speech order
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          speechId: speech.id, // Unique identifier for this speech
          message: 'Speech saved successfully',
        })
      );
    } catch (error) {
      // PRODUCTION: Logging disabled
// console.error('Error in debate speech:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
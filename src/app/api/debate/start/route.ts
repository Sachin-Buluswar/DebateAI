/**
 * @file src/app/api/debate/start/route.ts
 * @description API endpoint to start a new debate session
 * 
 * This endpoint creates a new debate session in the database and returns a session ID
 * that clients use to connect via WebSocket for real-time debate interaction.
 * 
 * Flow:
 * 1. Client calls this endpoint to initiate a debate
 * 2. Server creates debate session in Supabase
 * 3. Returns session ID for WebSocket connection
 * 4. Client connects to WebSocket using session ID
 * 
 * Related files:
 * - src/app/api/debate/realtime/route.ts - WebSocket management
 * - src/app/api/debate/end/route.ts - Session termination
 * - src/pages/api/socketio.ts - Socket.IO server (local dev)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

// Initialize Supabase admin client with service role key for full database access
// This bypasses Row Level Security (RLS) to create sessions on behalf of users
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key required for admin operations
);

// Request validation schema using Zod for type safety and input validation
const startDebateSchema = z.object({
  topic: z.string().min(1).max(500), // Debate topic with length constraints
  userSide: z.enum(['PRO', 'CON']), // Which side the user will argue
  userId: z.string().uuid(), // UUID of the authenticated user
  debaters: z.array(z.string()).optional(), // Optional list of participant names
});

/**
 * POST /api/debate/start
 * 
 * Starts a new debate session with AI partner
 * 
 * Request body:
 * {
 *   topic: string (1-500 chars) - The debate topic
 *   userSide: 'PRO' | 'CON' - Side the user will argue
 *   userId: string (UUID) - Authenticated user's ID
 *   debaters?: string[] - Optional participant names
 * }
 * 
 * Response:
 * Success (200): { success: true, sessionId: string, message: string }
 * Error (400): { error: 'Invalid request' }
 * Error (500): { error: 'Failed to create debate session' }
 * 
 * Rate limited to prevent spam session creation
 */
export async function POST(request: NextRequest) {
  // Apply debate-specific rate limiting (prevents rapid session creation)
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const body = await request.json();
      const validated = startDebateSchema.parse(body);

      // Create debate session in Supabase database
      // This creates a persistent record that tracks the debate state
      const { data: session, error } = await supabase
        .from('debate_sessions')
        .insert({
          topic: validated.topic, // The debate topic/resolution
          user_side: validated.userSide, // PRO or CON - determines user's position
          user_id: validated.userId, // Links session to authenticated user
          has_ai_partner: true, // Flag indicating AI opponent (always true for this app)
          status: 'active', // Initial status - will change to 'completed' on end
        })
        .select() // Return the created record
        .single(); // Expect single result

      if (error) {
        // PRODUCTION: Logging disabled
// console.error('Error creating debate session:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to create debate session' },
            { status: 500 }
          )
        );
      }

      // Return success response with session ID
      // Client should use this sessionId to:
      // 1. Connect to WebSocket/Realtime channel
      // 2. Reference in subsequent API calls (speech, analyze, end)
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          sessionId: session.id, // UUID to identify this debate session
          message: 'Debate session created. Connect via WebSocket for real-time interaction.',
        })
      );
    } catch (error) {
      // PRODUCTION: Logging disabled
// console.error('Error in debate start:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
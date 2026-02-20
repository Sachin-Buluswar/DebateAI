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
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

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
      // Get authenticated user's session (uses cookie-based auth)
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Unauthorized - Please log in to start a debate' },
            { status: 401 }
          )
        );
      }

      const body = await request.json();
      const validated = startDebateSchema.parse(body);
      
      // Verify the userId matches the authenticated user
      if (validated.userId !== user.id) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - Cannot create debate for another user' },
            { status: 403 }
          )
        );
      }

      // Create debate session using authenticated client (respects RLS)
      const { data: session, error } = await supabase
        .from('debate_sessions')
        .insert({
          topic: validated.topic, // The debate topic/resolution
          user_side: validated.userSide, // PRO or CON - determines user's position
          user_id: user.id, // Use authenticated user's ID
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
    } catch (_error) {
      // PRODUCTION: Logging disabled
// console.error('Error in debate start:', _error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
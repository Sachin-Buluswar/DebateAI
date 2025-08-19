/**
 * @file src/app/api/debate/end/route.ts
 * @description API endpoint to end an active debate session
 * 
 * This endpoint marks a debate as completed, optionally records the winner,
 * and performs cleanup operations. It's typically called when:
 * - User manually ends the debate
 * - Debate timer expires
 * - System detects inactivity
 * - Error conditions require session termination
 * 
 * Flow:
 * 1. Client sends session ID and optional winner/reason
 * 2. Server updates debate_sessions table status
 * 3. Records end timestamp and outcome
 * 4. Related WebSocket connections should be closed
 * 
 * Related files:
 * - src/app/api/debate/start/route.ts - Session creation
 * - src/app/api/debate/analyze/route.ts - Post-debate analysis
 * - src/backend/modules/realtimeDebate/orchestrator.ts - Manages debate flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

// Request validation schema for ending a debate
const endDebateSchema = z.object({
  sessionId: z.string().uuid(), // UUID of the debate session to end
  winner: z.enum(['PRO', 'CON', 'DRAW']).optional(), // Optional winner declaration
  reason: z.string().max(500).optional(), // Optional explanation for ending (e.g., 'timeout', 'user_requested')
});

/**
 * POST /api/debate/end
 * 
 * Ends an active debate session and records the outcome
 * 
 * Request body:
 * {
 *   sessionId: string (UUID) - ID of the debate session to end
 *   winner?: 'PRO' | 'CON' | 'DRAW' - Optional winner declaration
 *   reason?: string (max 500 chars) - Optional reason for ending
 * }
 * 
 * Response:
 * Success (200): { success: true, sessionId: string, message: string, winner?: string }
 * Error (400): { error: 'Invalid request' }
 * Error (500): { error: 'Failed to end debate session' }
 * 
 * Notes:
 * - Validates that the caller owns the session before allowing updates
 * - Should trigger WebSocket disconnection in real implementation
 * - Winner can be determined by AI judge or user vote
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      // Get authenticated user's session
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Unauthorized - Please log in to end a debate' },
            { status: 401 }
          )
        );
      }

      const body = await request.json();
      const validated = endDebateSchema.parse(body);

      // First, verify the user owns this debate session
      const { data: existingSession, error: checkError } = await supabase
        .from('debate_sessions')
        .select('id, user_id')
        .eq('id', validated.sessionId)
        .single();

      if (checkError || !existingSession) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Debate session not found' },
            { status: 404 }
          )
        );
      }

      if (existingSession.user_id !== user.id) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - Cannot end another user\'s debate' },
            { status: 403 }
          )
        );
      }

      // Update debate session status in database (now with proper ownership check)
      const { data: session, error } = await supabase
        .from('debate_sessions')
        .update({
          status: 'completed', // Change from 'active' to 'completed'
          winner: validated.winner, // Optional: 'PRO', 'CON', or 'DRAW'
          end_reason: validated.reason, // Optional: why debate ended
          ended_at: new Date().toISOString(), // Record exact end time
        })
        .eq('id', validated.sessionId) // Match by session ID
        .eq('user_id', user.id) // Ensure user owns the session
        .select() // Return updated record
        .single(); // Expect single result

      if (error) {
        // PRODUCTION: Logging disabled
// console.error('Error ending debate session:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to end debate session' },
            { status: 500 }
          )
        );
      }

      // Return success response with session details
      // Frontend should:
      // 1. Close WebSocket connections
      // 2. Show debate summary/results
      // 3. Optionally redirect to analysis page
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          sessionId: session.id, // Confirm which session was ended
          message: 'Debate session ended successfully',
          winner: session.winner, // Echo back the winner if provided
        })
      );
    } catch (error) {
      // PRODUCTION: Logging disabled
// console.error('Error in debate end:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
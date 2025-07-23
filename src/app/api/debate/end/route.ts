import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const endDebateSchema = z.object({
  sessionId: z.string().uuid(),
  winner: z.enum(['PRO', 'CON', 'DRAW']).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const body = await request.json();
      const validated = endDebateSchema.parse(body);

      // Update debate session status
      const { data: session, error } = await supabase
        .from('debate_sessions')
        .update({
          status: 'completed',
          winner: validated.winner,
          end_reason: validated.reason,
          ended_at: new Date().toISOString(),
        })
        .eq('id', validated.sessionId)
        .select()
        .single();

      if (error) {
        console.error('Error ending debate session:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to end debate session' },
            { status: 500 }
          )
        );
      }

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          sessionId: session.id,
          message: 'Debate session ended successfully',
          winner: session.winner,
        })
      );
    } catch (error) {
      console.error('Error in debate end:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
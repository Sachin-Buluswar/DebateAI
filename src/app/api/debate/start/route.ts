import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const startDebateSchema = z.object({
  topic: z.string().min(1).max(500),
  userSide: z.enum(['PRO', 'CON']),
  userId: z.string().uuid(),
  debaters: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const body = await request.json();
      const validated = startDebateSchema.parse(body);

      // Create debate session
      const { data: session, error } = await supabase
        .from('debate_sessions')
        .insert({
          topic: validated.topic,
          user_side: validated.userSide,
          user_id: validated.userId,
          has_ai_partner: true,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating debate session:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to create debate session' },
            { status: 500 }
          )
        );
      }

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          sessionId: session.id,
          message: 'Debate session created. Connect via WebSocket for real-time interaction.',
        })
      );
    } catch (error) {
      console.error('Error in debate start:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
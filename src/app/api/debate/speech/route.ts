import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const speechSchema = z.object({
  sessionId: z.string().uuid(),
  speakerId: z.string().uuid(),
  text: z.string().min(1).max(5000),
  side: z.enum(['PRO', 'CON']),
  timestamp: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const body = await request.json();
      const validated = speechSchema.parse(body);

      // Save speech to database
      const { data: speech, error } = await supabase
        .from('speeches')
        .insert({
          session_id: validated.sessionId,
          speaker_id: validated.speakerId,
          content: validated.text,
          side: validated.side,
          timestamp: validated.timestamp || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving speech:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to save speech' },
            { status: 500 }
          )
        );
      }

      // Update debate session last activity
      await supabase
        .from('debate_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          speech_count: supabase.rpc('increment', { x: 1 })
        })
        .eq('id', validated.sessionId);

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          speechId: speech.id,
          message: 'Speech saved successfully',
        })
      );
    } catch (error) {
      console.error('Error in debate speech:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        )
      );
    }
  });
}
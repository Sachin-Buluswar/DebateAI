import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/auth-middleware';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const saveSchema = z.object({
  topic: z.string().min(1).max(500),
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'ai']),
        text: z.string(),
        timestamp: z.number(),
      })
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  return withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedReq: AuthenticatedRequest) => {
      try {
        const body = await request.json();
        const { topic, transcript } = saveSchema.parse(body);

        const supabase = createClient();
        const { data, error } = await supabase
          .from('debate_history')
          .insert({
            user_id: authenticatedReq.user.id,
            title: topic,
            type: 'debate',
            transcript: JSON.stringify(transcript),
          })
          .select('id')
          .single();

        if (error) throw error;

        return NextResponse.json({ id: data.id });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid input', details: error.errors },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: 'Failed to save debate' }, { status: 500 });
      }
    });
  });
}

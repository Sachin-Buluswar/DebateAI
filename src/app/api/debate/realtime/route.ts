import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Request schemas
const startDebateSchema = z.object({
  debateId: z.string().uuid(),
  topic: z.string(),
  participants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    isAI: z.boolean(),
    team: z.enum(['PRO', 'CON']),
    role: z.string()
  }))
});

const joinDebateSchema = z.object({
  debateId: z.string().uuid(),
  userId: z.string()
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    try {
      const { pathname } = new URL(request.url);
    const action = pathname.split('/').pop();
    const body = await request.json();

    switch (action) {
      case 'start': {
        const { debateId, topic, participants } = startDebateSchema.parse(body);
        
        // Create debate record in database
        const { error: dbError } = await supabaseAdmin
          .from('debates')
          .insert({
            id: debateId,
            topic,
            participants,
            status: 'active',
            started_at: new Date().toISOString()
          });

        if (dbError) {
          return NextResponse.json({ error: 'Failed to create debate' }, { status: 500 });
        }

        // Initialize debate state in Realtime
        const channel = supabaseAdmin.channel(`debate:${debateId}`);
        await channel.send({
          type: 'broadcast',
          event: 'debate_initialized',
          payload: {
            debateId,
            topic,
            participants,
            phase: 'PRO_CONSTRUCTIVE',
            timestamp: Date.now()
          }
        });

        return NextResponse.json({ 
          success: true, 
          debateId,
          realtimeChannel: `debate:${debateId}` 
        });
      }

      case 'join': {
        const { debateId, userId } = joinDebateSchema.parse(body);
        
        // Verify debate exists
        const { data: debate, error } = await supabaseAdmin
          .from('debates')
          .select('*')
          .eq('id', debateId)
          .single();

        if (error || !debate) {
          return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          debate,
          realtimeChannel: `debate:${debateId}`
        });
      }

      case 'end': {
        const { debateId } = z.object({ debateId: z.string().uuid() }).parse(body);
        
        // Update debate status
        await supabaseAdmin
          .from('debates')
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString()
          })
          .eq('id', debateId);

        // Notify all participants
        const channel = supabaseAdmin.channel(`debate:${debateId}`);
        await channel.send({
          type: 'broadcast',
          event: 'debate_ended',
          payload: { debateId, timestamp: Date.now() }
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Debate realtime API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
  });
}

// GET endpoint to check debate status
export async function GET(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    const { searchParams } = new URL(request.url);
  const debateId = searchParams.get('debateId');

  if (!debateId) {
    return NextResponse.json({ error: 'Debate ID required' }, { status: 400 });
  }

  const { data: debate, error } = await supabaseAdmin
    .from('debates')
    .select('*')
    .eq('id', debateId)
    .single();

  if (error || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  }

  return NextResponse.json({ debate });
  });
}
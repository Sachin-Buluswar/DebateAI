/**
 * API endpoints for managing real-time debate sessions via Supabase Realtime
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { z } from 'zod';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';

// Request validation schemas using Zod
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

// Helper to get service client for Realtime operations only
function getRealtimeServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

const joinDebateSchema = z.object({
  debateId: z.string().uuid(),
  userId: z.string()
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest: AuthenticatedRequest) => {
    try {
      const user = authenticatedRequest.user;
      const supabase = createClient();

      // Extract action from URL path
      const { pathname } = new URL(request.url);
      const action = pathname.split('/').pop();
      const body = await request.json();

    switch (action) {
      case 'start': {
        const { debateId, topic, participants } = startDebateSchema.parse(body);

        // Verify user is a participant in this debate
        const userParticipant = participants.find(p => p.id === user.id);
        if (!userParticipant && !participants.some(p => p.isAI)) {
          return NextResponse.json(
            { error: 'Forbidden - User must be a participant' },
            { status: 403 }
          );
        }

        // Create debate record in database with authenticated client
        const { error: dbError } = await supabase
          .from('debates')
          .insert({
            id: debateId,
            topic,
            participants,
            status: 'active',
            started_at: new Date().toISOString(),
            user_id: user.id
          });

        if (dbError) {
          return NextResponse.json({ error: 'Failed to create debate' }, { status: 500 });
        }

        // Use service client only for Realtime channel operations
        const realtimeClient = getRealtimeServiceClient();
        const channel = realtimeClient.channel(`debate:${debateId}`);

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

        // Verify the userId matches the authenticated user
        if (userId !== user.id) {
          return NextResponse.json(
            { error: 'Forbidden - Cannot join as another user' },
            { status: 403 }
          );
        }

        // Verify debate exists and is active using authenticated client
        const { data: debate, error } = await supabase
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

        // First verify user owns or participates in this debate
        const { data: debate, error: checkError } = await supabase
          .from('debates')
          .select('user_id, participants')
          .eq('id', debateId)
          .single();

        if (checkError || !debate) {
          return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        // Check if user is the creator or a participant
        const isCreator = debate.user_id === user.id;
        const isParticipant = (debate.participants as Array<{ id: string }>)?.some(
          (p: { id: string }) => p.id === user.id
        );

        if (!isCreator && !isParticipant) {
          return NextResponse.json(
            { error: 'Forbidden - Cannot end this debate' },
            { status: 403 }
          );
        }

        // Update debate status in database
        const { error: updateError } = await supabase
          .from('debates')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString()
          })
          .eq('id', debateId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to end debate' }, { status: 500 });
        }

        // Use service client only for Realtime notifications
        const realtimeClient = getRealtimeServiceClient();
        const channel = realtimeClient.channel(`debate:${debateId}`);
        await channel.send({
          type: 'broadcast',
          event: 'debate_ended',
          payload: {
            debateId,
            timestamp: Date.now()
          }
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
    });
  });
}

export async function GET(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    return requireAuth(request, async (_authenticatedRequest: AuthenticatedRequest) => {
    const supabase = createClient();

    // Extract debate ID from query parameters
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debateId');

    if (!debateId) {
      return NextResponse.json({ error: 'Debate ID required' }, { status: 400 });
    }

    // Query database for debate record using authenticated client
    const { data: debate, error } = await supabase
      .from('debates')
      .select('*')
      .eq('id', debateId)
      .single();

    if (error || !debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    return NextResponse.json({ debate });
    });
  });
}

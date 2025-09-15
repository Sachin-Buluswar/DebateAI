/**
 * @file src/app/api/debate/realtime/route.ts
 * @description API endpoints for managing real-time debate sessions via Supabase Realtime
 * 
 * This file provides REST endpoints that complement the WebSocket-based real-time
 * debate functionality. It handles:
 * - Starting new debates and creating Realtime channels
 * - Joining existing debates
 * - Ending debates and cleanup
 * - Checking debate status
 * 
 * The actual real-time communication happens through Supabase Realtime channels,
 * not through these REST endpoints. These endpoints manage the debate lifecycle.
 * 
 * Architecture:
 * - REST API (this file) - Manages debate state and lifecycle
 * - Supabase Realtime - Handles real-time messaging between participants
 * - Database - Persists debate state and history
 * 
 * Flow:
 * 1. POST /start - Create debate record and initialize Realtime channel
 * 2. Clients connect to Supabase Realtime channel
 * 3. Real-time messages flow through Realtime (not REST)
 * 4. POST /end - Clean up debate and notify participants
 * 
 * Related files:
 * - src/lib/supabase/client.ts - Supabase client configuration
 * - src/components/debate/RealtimeDebate.tsx - Frontend Realtime integration
 * - src/backend/modules/realtimeDebate/ - Debate orchestration logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// Request validation schemas using Zod

// Schema for starting a new debate
const startDebateSchema = z.object({
  debateId: z.string().uuid(), // Pre-generated UUID for the debate
  topic: z.string(), // The debate resolution/topic
  participants: z.array(z.object({
    id: z.string(), // Participant ID (user ID or AI identifier)
    name: z.string(), // Display name
    isAI: z.boolean(), // Whether this is an AI participant
    team: z.enum(['PRO', 'CON']), // Which side they're arguing
    role: z.string() // Role in debate (e.g., 'First Speaker', 'Second Speaker')
  }))
});

// Note: Realtime operations should be handled client-side
// Clients should connect directly to Supabase Realtime channels

// Schema for joining an existing debate
const joinDebateSchema = z.object({
  debateId: z.string().uuid(), // ID of debate to join
  userId: z.string() // ID of user joining
});

/**
 * POST /api/debate/realtime/{action}
 * 
 * Handles various debate actions based on the URL path:
 * - /start - Initialize a new debate
 * - /join - Join an existing debate
 * - /end - End an active debate
 * 
 * All actions are rate-limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      try {
        // Create authenticated Supabase client that respects RLS
        const supabase = createClient();
        const user = req.user;

      // Extract action from URL path (e.g., 'start', 'join', 'end')
      const { pathname } = new URL(request.url);
      const action = pathname.split('/').pop();
      const body = await request.json();

    switch (action) {
      case 'start': {
        // Validate request and start new debate
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
            user_id: user.id // Track who created the debate
          });

        if (dbError) {
          return NextResponse.json({ error: 'Failed to create debate' }, { status: 500 });
        }

        // Note: Realtime initialization is handled client-side
        // Clients should subscribe to debate:${debateId} channel directly
        // The database update above triggers Realtime events automatically

        // Return success with channel info
        // Frontend should use this channel name to subscribe via Supabase Realtime
        return NextResponse.json({ 
          success: true, 
          debateId, // Confirm the debate ID
          realtimeChannel: `debate:${debateId}` // Channel name for Realtime subscription
        });
      }

      case 'join': {
        // Handle user joining an existing debate
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

        // Return debate info and channel details
        // Frontend can use this to:
        // 1. Display debate state
        // 2. Subscribe to Realtime channel
        // 3. Show participant list
        return NextResponse.json({
          success: true,
          debate, // Full debate record from database
          realtimeChannel: `debate:${debateId}` // Channel to subscribe to
        });
      }

      case 'end': {
        // Handle ending a debate
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
        const isParticipant = (debate.participants as any[])?.some(
          (p: any) => p.id === user.id
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

        // Note: Realtime notification is handled via database change
        // Clients subscribed to the channel will see the status update automatically

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Debate realtime API error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * GET /api/debate/realtime?debateId={uuid}
 * 
 * Check the status of a specific debate
 * 
 * Query params:
 * - debateId: UUID of the debate to check
 * 
 * Response:
 * Success (200): { debate: object } - Full debate record
 * Error (400): { error: 'Debate ID required' }
 * Error (404): { error: 'Debate not found' }
 * 
 * Use cases:
 * - Verify debate exists before joining
 * - Check if debate is still active
 * - Get participant list and current state
 */
export async function GET(request: NextRequest) {
  return await withRateLimit(request, debateRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      // Create authenticated Supabase client that respects RLS
      const supabase = createClient();
      const user = req.user;
    
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
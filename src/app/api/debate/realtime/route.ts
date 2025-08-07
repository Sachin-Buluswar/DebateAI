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
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';

// Initialize Supabase admin client with service role key
// This client has full database access and can create/manage Realtime channels
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin access required for channel management
  {
    auth: {
      autoRefreshToken: false, // Not needed for server-side admin client
      persistSession: false // No session persistence on server
    }
  }
);

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
    try {
      // Extract action from URL path (e.g., 'start', 'join', 'end')
      const { pathname } = new URL(request.url);
      const action = pathname.split('/').pop();
      const body = await request.json();

    switch (action) {
      case 'start': {
        // Validate request and start new debate
        const { debateId, topic, participants } = startDebateSchema.parse(body);
        
        // Create debate record in database
        // This establishes the persistent state for the debate
        const { error: dbError } = await supabaseAdmin
          .from('debates')
          .insert({
            id: debateId, // Use provided UUID
            topic, // Debate resolution/topic
            participants, // Array of participant objects
            status: 'active', // Initial status
            started_at: new Date().toISOString() // Track start time
          });

        if (dbError) {
          return NextResponse.json({ error: 'Failed to create debate' }, { status: 500 });
        }

        // Initialize debate state in Realtime
        // This creates a Supabase Realtime channel for this debate
        // All participants will subscribe to this channel for real-time updates
        const channel = supabaseAdmin.channel(`debate:${debateId}`);
        
        // Broadcast initial debate state to channel
        // Any clients already subscribed will receive this
        await channel.send({
          type: 'broadcast', // Broadcast to all subscribers
          event: 'debate_initialized', // Event type for clients to handle
          payload: {
            debateId,
            topic,
            participants,
            phase: 'PRO_CONSTRUCTIVE', // Start with PRO team's constructive speech
            timestamp: Date.now()
          }
        });

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
        
        // Verify debate exists and is active
        // This prevents joining non-existent or ended debates
        const { data: debate, error } = await supabaseAdmin
          .from('debates')
          .select('*') // Get all debate data
          .eq('id', debateId)
          .single(); // Expect exactly one result

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
        
        // Update debate status in database
        // This marks the debate as completed and records end time
        await supabaseAdmin
          .from('debates')
          .update({ 
            status: 'completed', // Change from 'active' to 'completed'
            ended_at: new Date().toISOString() // Record when debate ended
          })
          .eq('id', debateId);

        // Notify all participants via Realtime
        // This ensures all connected clients know the debate has ended
        const channel = supabaseAdmin.channel(`debate:${debateId}`);
        await channel.send({
          type: 'broadcast', // Send to all subscribers
          event: 'debate_ended', // Event type for client handling
          payload: { 
            debateId, 
            timestamp: Date.now() // When the debate ended
          }
        });

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
    // Extract debate ID from query parameters
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debateId');

  if (!debateId) {
    return NextResponse.json({ error: 'Debate ID required' }, { status: 400 });
  }

  // Query database for debate record
  // Returns full debate data including participants and status
  const { data: debate, error } = await supabaseAdmin
    .from('debates')
    .select('*') // Get all columns
    .eq('id', debateId) // Match by debate ID
    .single(); // Expect single result

  if (error || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  }

  return NextResponse.json({ debate });
  });
}
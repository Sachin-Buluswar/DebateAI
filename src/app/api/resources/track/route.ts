import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { optionalAuth } from '@/lib/auth-middleware';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { z } from 'zod';
import { headers } from 'next/headers';
import { User } from '@supabase/supabase-js';

const trackingSchema = z.object({
  resourceId: z.string().uuid(),
  eventType: z.enum(['view', 'download', 'share', 'complete']),
  sessionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  return withRateLimit(request, apiRateLimiter, async () => {
    return optionalAuth(request, async (req: NextRequest & { user?: User }) => {
      try {
        const body = await request.json();
        const validated = trackingSchema.parse(body);

        const supabase = createClient();
        const headersList = headers();
        const userAgent = headersList.get('user-agent') || undefined;
        const referrer = headersList.get('referer') || undefined;

        const user = req.user || null;

        // Get IP address (in production, this would come from X-Forwarded-For)
        const ipAddress =
          headersList.get('x-forwarded-for')?.split(',')[0] ||
          headersList.get('x-real-ip') ||
          undefined;

        // Insert analytics record
        const { error: analyticsError } = await supabase.from('resource_analytics').insert({
          resource_id: validated.resourceId,
          user_id: user?.id || null,
          event_type: validated.eventType,
          session_id: validated.sessionId,
          user_agent: userAgent,
          ip_address: ipAddress,
          referrer: referrer,
          metadata: validated.metadata || {},
        });

        if (analyticsError) {
          return NextResponse.json({ error: 'Failed to track analytics' }, { status: 500 });
        }

        // Return updated counts
        const { data: resource } = await supabase
          .from('educational_resources')
          .select('view_count, download_count')
          .eq('id', validated.resourceId)
          .single();

        return NextResponse.json({
          success: true,
          counts: resource || { view_count: 0, download_count: 0 },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request data', details: error.errors },
            { status: 400 }
          );
        }

        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    });
  });
}

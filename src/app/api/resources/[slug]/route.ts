import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Resource slug is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: resource, error } = await supabase
      .from('educational_resources')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) {
      // Check if error is due to missing table
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Resource not found',
            message: 'Resources are being set up. Please check back soon!'
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }
    
    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ resource });
    } catch (error) {
      console.error('API Error [/api/resources/[slug]]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
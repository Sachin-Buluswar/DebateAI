import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { z } from 'zod';

const querySchema = z.object({
  category: z.enum(['guides', 'lessons', 'slideshows', 'worksheets']).optional(),
  tags: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  featured: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
});

export async function GET(request: NextRequest) {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('educational_resources')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (params.category) {
      query = query.eq('category', params.category);
    }

    if (params.difficulty) {
      query = query.eq('difficulty', params.difficulty);
    }

    if (params.featured !== undefined) {
      query = query.eq('is_featured', params.featured);
    }

    if (params.tags) {
      const tagArray = params.tags.split(',');
      query = query.contains('tags', tagArray);
    }

    // Apply pagination
    query = query.range(params.offset, params.offset + params.limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching resources:', error);
      
      // Check if error is due to missing table
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json({
          resources: [],
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasMore: false
          },
          message: 'Learning resources are being set up. Please check back soon!'
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch resources' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resources: data || [],
      pagination: {
        limit: params.limit,
        offset: params.offset,
        hasMore: data?.length === params.limit
      }
    });
    } catch (error) {
      console.error('API Error [/api/resources]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
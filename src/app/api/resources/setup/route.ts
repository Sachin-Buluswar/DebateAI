import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  // This endpoint modifies the database, so it MUST be admin-only
  return requireAdmin(request, async (req) => {
    try {
      // Use authenticated client that respects RLS
      const supabase = createClient();
      
      // Check if table exists by trying to query it
      const { error: checkError } = await supabase
        .from('educational_resources')
        .select('id')
        .limit(1);

      if (checkError && checkError.message.includes('relation')) {
        // Table doesn't exist
        return NextResponse.json({
          error: 'Database table not found',
          message: 'The educational_resources table needs to be created. Please run the migration:',
          sqlFile: '/src/backend/migrations/create_resources_table.sql',
          instructions: 'Run this SQL in your Supabase dashboard SQL editor'
        }, { status: 503 });
      }

      // Check if the initial resource already exists
      const { data: existingResource } = await supabase
        .from('educational_resources')
        .select('*')
        .eq('slug', 'intro-to-public-forum')
        .single();

      if (existingResource) {
        return NextResponse.json({
          message: 'Resources already set up',
          resource: existingResource
        });
      }

      // Insert the initial resource
      const { data: newResource, error: insertError } = await supabase
        .from('educational_resources')
        .insert({
          title: 'Introduction to Public Forum Debate',
          slug: 'intro-to-public-forum',
          description: 'A comprehensive slideshow covering the fundamentals of Public Forum debate, including round structure, speech types, and strategic concepts. Perfect for beginners and those new to competitive debate.',
          category: 'slideshows',
          file_url: '/resources/slideshows/intro-to-public-forum.pdf',
          file_type: 'pdf',
          authors: ['Sachin Buluswar', 'Kevin Cheng'],
          tags: ['beginner', 'fundamentals', 'public-forum', 'round-structure', 'speeches'],
          difficulty: 'beginner',
          duration_minutes: 30,
          is_featured: true,
          is_published: true
        })
        .select()
        .single();

      if (insertError) {
        // PRODUCTION: Logging disabled
        // console.error('[resources-setup] Error inserting resource:', insertError);
        return NextResponse.json(
          { 
            error: 'Failed to insert initial resource',
            details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Resources setup completed successfully',
        resource: newResource,
        adminUser: req.user.email
      });
    } catch (_error) {
      // PRODUCTION: Logging disabled
      // console.error('[resources-setup] Setup error:', _error);
      return NextResponse.json(
        { 
          error: 'Failed to setup resources',
          details: process.env.NODE_ENV === 'development' ? String(_error) : undefined
        },
        { status: 500 }
      );
    }
  });
}

// Also add POST method for completeness
export async function POST(request: NextRequest) {
  return GET(request);
}
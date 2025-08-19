import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Check for setup key in query params for basic protection
    const { searchParams } = new URL(request.url);
    const setupKey = searchParams.get('key');
    
    if (setupKey !== 'setup-learn-2024') {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Using service role for admin operations
    );

    // Check if table exists by trying to query it
    const { data: existingResources, error: checkError } = await supabase
      .from('educational_resources')
      .select('id')
      .limit(1);

    if (checkError && checkError.message.includes('relation')) {
      // Table doesn't exist, let's create it
      // PRODUCTION: Console disabled
      // console.log('Creating educational_resources table...');
      
      try {
        // Create the table using raw SQL
        const createTableSQL = `
          CREATE TABLE educational_resources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            category TEXT NOT NULL CHECK (category IN ('guides', 'lessons', 'slideshows', 'worksheets')),
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL DEFAULT 'pdf',
            thumbnail_url TEXT,
            authors TEXT[] NOT NULL DEFAULT '{}',
            tags TEXT[] DEFAULT '{}',
            difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
            duration_minutes INTEGER,
            download_count INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            is_featured BOOLEAN DEFAULT false,
            is_published BOOLEAN DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          ALTER TABLE educational_resources ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Published resources are viewable by everyone" ON educational_resources
            FOR SELECT
            USING (is_published = true);
        `;
        
        // Execute the SQL using fetch to Supabase's REST API
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
          },
          body: JSON.stringify({ sql: createTableSQL })
        });
        
        if (!response.ok) {
          // PRODUCTION: Console disabled
          // console.log('REST API approach failed, table might already exist or need manual creation');
          return NextResponse.json({
            error: 'Database tables not created yet',
            message: 'Please run the SQL migration in Supabase dashboard:',
            sqlFile: '/src/backend/migrations/create_resources_table.sql',
            tableCreationAttempted: true
          }, { status: 500 });
        }
        
        // PRODUCTION: Console disabled
        
        // console.log('Table created successfully!');
        
        // Continue with the rest of the setup process
      } catch (error) {
        // PRODUCTION: Console disabled
        // console.error('Error creating table:', error);
        return NextResponse.json({
          error: 'Database tables not created yet',
          message: 'Please run the SQL migration in Supabase dashboard:',
          sqlFile: '/src/backend/migrations/create_resources_table.sql'
        }, { status: 500 });
      }
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
      // PRODUCTION: Console disabled
      // console.error('Error inserting resource:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert initial resource', details: insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Resources setup completed successfully',
      resource: newResource
    });
  } catch (error) {
    // PRODUCTION: Console disabled
    // console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup resources' },
      { status: 500 }
    );
  }
}
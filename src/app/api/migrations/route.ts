import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Get service role key from environment
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(): Promise<NextResponse> {
  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );
    
    // Create SQL execution function if it doesn't exist
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION exec_sql(query text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE query;
      END;
      $$;
    `;
    
    // Execute the SQL directly to create the function
    try {
      const { error: functionError } = await supabaseAdmin.rpc('exec_sql', {
        query: createFunctionQuery
      });
      
      if (functionError) {
        console.log('Error creating exec_sql function, it might already exist:', functionError.message);
      }
    } catch {
      console.log('Function does not exist yet, this is normal on first run');
      // Try a direct SQL approach instead, but we'll continue regardless
      try {
        await supabaseAdmin.from('_exec_sql_direct').select('*').limit(1);
      } catch {
        // Expected to fail, just continue
      }
    }
    
    // Read the migration file
    const migrationFilePath = path.join(
      process.cwd(),
      'src',
      'backend',
      'migrations',
      'add_audio_url_to_debate_history.sql'
    );
    
    const migrationContent = await fs.readFile(migrationFilePath, 'utf-8');
    
    // Apply migration with different approaches
    let migrationError: Error | null = null;
    
    // Approach 1: Try using exec_sql RPC
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        query: migrationContent
      });
      
      if (!error) {
        return NextResponse.json({
          message: 'Migration executed successfully via exec_sql RPC',
          success: true
        });
      } else {
        migrationError = error as Error;
      }
    } catch (err: unknown) {
      console.error('Error using exec_sql RPC:', err);
    }
    
    // Approach 2: Try direct SQL with REST API
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
        },
        body: JSON.stringify({ query: migrationContent })
      });
      
      if (response.ok) {
        return NextResponse.json({
          message: 'Migration executed successfully via REST API',
          success: true
        });
      }
    } catch (err: unknown) {
      console.error('Error using REST API:', err);
    }
    
    // If we got here, we couldn't execute the migration
    return NextResponse.json(
      { 
        error: `Failed to apply migration: ${migrationError?.message || 'Unknown error'}`,
        message: "Please use the Supabase SQL Editor to add the audio_url column to debate_history table"
      },
      { status: 500 }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error('Error executing migration:', error);
    return NextResponse.json(
      { 
        error: `Error executing migration: ${errorMessage}`,
        message: "Please use the Supabase SQL Editor to add the audio_url column to debate_history table. SQL: ALTER TABLE debate_history ADD COLUMN IF NOT EXISTS audio_url TEXT;"
      },
      { status: 500 }
    );
  }
} 
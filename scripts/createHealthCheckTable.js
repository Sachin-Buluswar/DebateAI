#!/usr/bin/env node

/**
 * Create Health Check Table Utility
 * Creates a health_check table in Supabase for connection testing
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env.local file');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createHealthCheckTable() {
  console.log('Creating health_check table in Supabase...');
  
  try {
    // Using Postgres functions directly through Supabase
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.health_check (
          id SERIAL PRIMARY KEY,
          status TEXT DEFAULT 'ok',
          last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
          message TEXT
        );
        
        -- Insert initial record if none exists
        INSERT INTO public.health_check (status, message)
        SELECT 'ok', 'System is healthy'
        WHERE NOT EXISTS (SELECT 1 FROM public.health_check);
      `
    });
    
    if (error) {
      if (error.message.includes('function "exec_sql" does not exist')) {
        console.log('exec_sql function not available. Creating health_check table using data API...');
        
        // Alternative: try to create using the data API
        try {
          // First check if the table exists
          const { error: checkError } = await supabase
            .from('health_check')
            .select('count(*)')
            .limit(1)
            .maybeSingle();
          
          if (checkError) {
            if (checkError.message.includes('relation "health_check" does not exist') ||
                checkError.message.includes('does not exist')) {
              console.log('health_check table does not exist, please create it manually in the Supabase dashboard.');
              console.log('SQL to execute in the SQL editor:');
              console.log(`
CREATE TABLE IF NOT EXISTS public.health_check (
  id SERIAL PRIMARY KEY,
  status TEXT DEFAULT 'ok',
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  message TEXT
);

-- Insert initial record
INSERT INTO public.health_check (status, message)
VALUES ('ok', 'System is healthy')
ON CONFLICT DO NOTHING;`);
            } else {
              console.error('Error checking health_check table:', checkError);
            }
          } else {
            console.log('health_check table exists, attempting to insert record');
            // Insert a record
            const { error: insertError } = await supabase
              .from('health_check')
              .insert([
                { status: 'ok', message: 'System is healthy' }
              ])
              .single();
            
            if (insertError) {
              console.error('Error inserting record:', insertError);
            } else {
              console.log('Added health_check record successfully');
            }
          }
        } catch (dataApiError) {
          console.error('Error with data API fallback:', dataApiError);
        }
      } else {
        console.error('Error executing SQL:', error);
      }
    } else {
      console.log('Health check table created successfully');
    }
    
    // Test query to see if we can access the table
    try {
      const { data: healthData, error: healthError } = await supabase
        .from('health_check')
        .select('*')
        .limit(1);
      
      if (healthError) {
        console.error('Error querying health_check table:', healthError);
      } else {
        console.log('Health check query successful:', healthData);
      }
    } catch (queryError) {
      console.error('Error testing health_check table:', queryError);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Execute the function
createHealthCheckTable().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 
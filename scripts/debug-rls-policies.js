#!/usr/bin/env node

/**
 * DebateAI - Debug RLS Policies
 * Detailed debugging of RLS policy behavior
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

async function debugRLS() {
  log('\n🔍 RLS Policy Debugging', YELLOW);
  log('======================\n', YELLOW);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log('Missing Supabase credentials', RED);
    return;
  }

  // Create anon client (unauthenticated)
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Test each table
  const tables = [
    'user_profiles',
    'debate_sessions',
    'debate_speeches',
    'speech_feedback',
    'saved_searches',
    'user_preferences'
  ];

  log('Testing with ANON client (unauthenticated):', BLUE);
  log('=========================================\n', BLUE);

  for (const table of tables) {
    log(`Testing ${table}:`, YELLOW);
    
    try {
      // Try SELECT
      const { data: selectData, error: selectError, count } = await anonClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (selectError) {
        if (selectError.code === 'PGRST301' || selectError.message.includes('row-level security')) {
          log(`  ✓ SELECT blocked by RLS`, GREEN);
        } else {
          log(`  ✓ SELECT blocked: ${selectError.message}`, GREEN);
        }
      } else {
        log(`  ✗ SELECT allowed! (${count} rows accessible)`, RED);
      }

      // Try INSERT
      const testData = {
        user_id: '00000000-0000-0000-0000-000000000000',
        // Add minimal required fields based on table
        ...(table === 'user_profiles' ? { email: 'test@test.com' } : {}),
        ...(table === 'debate_sessions' ? { topic: 'test' } : {}),
        ...(table === 'speech_feedback' ? { transcript: 'test' } : {}),
        ...(table === 'saved_searches' ? { search_query: 'test' } : {}),
      };

      const { error: insertError } = await anonClient
        .from(table)
        .insert(testData);

      if (insertError) {
        if (insertError.code === 'PGRST301' || insertError.message.includes('row-level security')) {
          log(`  ✓ INSERT blocked by RLS`, GREEN);
        } else {
          log(`  ✓ INSERT blocked: ${insertError.code}`, GREEN);
        }
      } else {
        log(`  ✗ INSERT allowed!`, RED);
      }

    } catch (error) {
      log(`  Error testing ${table}: ${error.message}`, RED);
    }
    
    log(''); // Empty line between tables
  }

  // Test with service role key if available
  if (SUPABASE_SERVICE_KEY) {
    log('\nTesting with SERVICE ROLE client (bypasses RLS):', BLUE);
    log('===============================================\n', BLUE);
    
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // Check if policies exist
    try {
      const { data: policies, error } = await serviceClient
        .from('pg_policies')
        .select('*')
        .eq('schemaname', 'public')
        .in('tablename', tables);

      if (!error && policies) {
        log('RLS Policies found:', GREEN);
        const policyCount = {};
        policies.forEach(p => {
          policyCount[p.tablename] = (policyCount[p.tablename] || 0) + 1;
        });
        
        Object.entries(policyCount).forEach(([table, count]) => {
          log(`  ${table}: ${count} policies`, YELLOW);
        });
        
        // List policy names
        log('\nPolicy details:', BLUE);
        policies.forEach(p => {
          log(`  ${p.tablename}.${p.policyname}: ${p.cmd} (${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`, YELLOW);
        });
      }
    } catch (error) {
      log('Could not fetch policies', YELLOW);
    }
  }

  // Check for common RLS issues
  log('\n📋 Common RLS Issues to Check:', BLUE);
  log('============================\n', BLUE);
  
  log('1. Check if policies use auth.uid() correctly');
  log('2. Ensure no USING(true) policies that allow all access');
  log('3. Verify foreign key relationships in policies');
  log('4. Check if service role key is being used accidentally in app');
  log('5. Ensure Supabase client is initialized with anon key, not service key');
  
  log('\n💡 Debug Queries to Run in Supabase SQL Editor:', YELLOW);
  log('===========================================\n', YELLOW);
  
  log(`-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- List all policies
SELECT * FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check specific policy definition
SELECT pol.polname, pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid) as qual
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
WHERE nsp.nspname = 'public';`);
}

// Run debugging
debugRLS().catch(error => {
  log(`\nUnexpected error: ${error.message}`, RED);
  process.exit(1);
});
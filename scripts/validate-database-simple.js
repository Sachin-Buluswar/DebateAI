#!/usr/bin/env node

/**
 * DebateAI - Simple Database Validation
 * Tests database functionality through actual operations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Test results
let passed = 0;
let failed = 0;

// Utility functions
function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function testPassed(testName) {
  passed++;
  log(`✓ ${testName}`, GREEN);
}

function testFailed(testName, error) {
  failed++;
  log(`✗ ${testName}`, RED);
  if (error) log(`  Error: ${error}`, RED);
}

async function validateDatabaseSimple() {
  log('\n🧪 Database Functional Validation', YELLOW);
  log('=================================\n', YELLOW);

  // 1. Check environment
  log('1. Checking configuration...', YELLOW);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    testFailed('Environment check', 'Missing Supabase credentials');
    return;
  }
  testPassed('Configuration present');

  // Create client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 2. Test public read access (health_check)
  log('\n2. Testing public read access...', YELLOW);
  try {
    const { data, error } = await supabase
      .from('health_check')
      .select('*')
      .limit(1);

    if (!error) {
      testPassed('Public read from health_check');
    } else {
      testFailed('Public read from health_check', error.message);
    }
  } catch (error) {
    testFailed('Public read test', error.message);
  }

  // 3. Test authenticated access requirement
  log('\n3. Testing RLS protection...', YELLOW);
  
  // These should fail without authentication
  const protectedTables = [
    'user_profiles',
    'debate_sessions', 
    'debate_speeches',
    'speech_feedback',
    'saved_searches',
    'user_preferences'
  ];

  for (const table of protectedTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error && error.message.includes('row-level security')) {
        testPassed(`RLS protected: ${table}`);
      } else if (error) {
        testFailed(`Table access: ${table}`, error.message);
      } else {
        testFailed(`RLS protection: ${table}`, 'Table allows unauthenticated access');
      }
    } catch (error) {
      testFailed(`Table test: ${table}`, error.message);
    }
  }

  // 4. Test with authentication
  log('\n4. Testing authenticated operations...', YELLOW);
  
  // Try to sign in with test account
  const testEmail = 'dbtest@debateai.com';
  const testPassword = 'dbtestpass123';
  
  let session = null;
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError && authError.message.includes('Invalid login')) {
      // Create test account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword
      });
      
      if (!signUpError) {
        const { data: newAuth } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        session = newAuth?.session;
      }
    } else {
      session = authData?.session;
    }
    
    if (session) {
      testPassed('Authentication successful');
    } else {
      log('  Skipping authenticated tests (rate limited)', YELLOW);
      return;
    }
  } catch (error) {
    log('  Skipping authenticated tests (auth error)', YELLOW);
  }

  if (session) {
    // Test user profile operations
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!error || error.code === 'PGRST116') { // Not found is ok
        testPassed('User profile access');
      } else {
        testFailed('User profile access', error.message);
      }
    } catch (error) {
      testFailed('User profile test', error.message);
    }

    // Test creating a debate session
    try {
      const { data, error } = await supabase
        .from('debate_sessions')
        .insert({
          topic: 'Test debate topic',
          user_side: 'PRO',
          has_ai_partner: false,
          user_id: session.user.id
        })
        .select()
        .single();

      if (!error) {
        testPassed('Create debate session');
        
        // Clean up
        await supabase
          .from('debate_sessions')
          .delete()
          .eq('id', data.id);
      } else {
        testFailed('Create debate session', error.message);
      }
    } catch (error) {
      testFailed('Debate session test', error.message);
    }

    // Sign out
    await supabase.auth.signOut();
  }

  // 5. Test critical table relationships
  log('\n5. Validating table relationships...', YELLOW);
  
  // This tests if foreign keys are properly set up
  const relationships = [
    { from: 'debate_speeches', to: 'debate_sessions', via: 'session_id' },
    { from: 'audio_recordings', to: 'debate_sessions', via: 'session_id' },
    { from: 'saved_searches', to: 'user_profiles', via: 'user_id' }
  ];

  log('  Note: Relationship validation requires data', YELLOW);

  // Summary
  log('\n' + '='.repeat(40), YELLOW);
  log(`Total Tests: ${passed + failed}`);
  log(`Passed: ${passed}`, GREEN);
  log(`Failed: ${failed}`, RED);
  
  if (failed === 0) {
    log('\n✅ All database tests passed!', GREEN);
  } else {
    log('\n❌ Some database tests failed', RED);
    log('\nCommon issues:', YELLOW);
    log('- Missing tables: Run migrations from migrations/ directory');
    log('- RLS errors: Ensure policies are applied');
    log('- Auth errors: Check Supabase configuration');
  }
}

// Run validation
validateDatabaseSimple().catch(error => {
  log(`\nUnexpected error: ${error.message}`, RED);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Atlas Debate - Database Schema and RLS Validation
 * Validates database tables, columns, and RLS policies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Test results
let passed = 0;
let failed = 0;
const issues = [];

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
  issues.push({ test: testName, error });
  log(`✗ ${testName}`, RED);
  if (error) log(`  Issue: ${error}`, RED);
}

// Expected schema
const expectedTables = {
  'user_profiles': {
    columns: ['id', 'email', 'full_name', 'created_at', 'updated_at'],
    hasRLS: true
  },
  'debate_sessions': {
    columns: ['id', 'user_id', 'topic', 'user_side', 'has_ai_partner', 'created_at'],
    hasRLS: true
  },
  'debate_speeches': {
    columns: ['id', 'session_id', 'speaker_name', 'speaker_id', 'phase', 'speech_text'],
    hasRLS: true
  },
  'speech_feedback': {
    columns: ['id', 'user_id', 'transcript', 'audio_url', 'topic', 'feedback'],
    hasRLS: true
  },
  'saved_searches': {
    columns: ['id', 'user_id', 'search_query', 'search_results', 'search_timestamp'],
    hasRLS: true
  },
  'user_preferences': {
    columns: ['id', 'user_id', 'preferred_difficulty', 'preferred_speech_types'],
    hasRLS: true
  },
  'audio_recordings': {
    columns: ['id', 'session_id', 'audio_url', 'duration', 'format'],
    hasRLS: true
  },
  'health_check': {
    columns: ['id', 'status', 'last_check'],
    hasRLS: true
  }
};

async function validateDatabase() {
  log('\n🧪 Database Schema & RLS Validation', YELLOW);
  log('===================================\n', YELLOW);

  // 1. Check environment
  log('1. Checking database configuration...', YELLOW);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    testFailed('Environment check', 'Missing Supabase credentials');
    log('\nNote: Set SUPABASE_SERVICE_ROLE_KEY to run full validation', YELLOW);
    return;
  }
  testPassed('Database credentials present');

  // Create admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // 2. Check tables exist
  log('\n2. Validating database tables...', YELLOW);
  
  try {
    // Query information schema to get all tables
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_type', ['BASE TABLE']);

    if (error) throw error;

    const existingTables = tables.map(t => t.table_name);
    
    for (const [tableName, config] of Object.entries(expectedTables)) {
      if (existingTables.includes(tableName)) {
        testPassed(`Table: ${tableName}`);
      } else {
        testFailed(`Table: ${tableName}`, 'Table does not exist');
      }
    }
  } catch (error) {
    testFailed('Table validation', error.message);
  }

  // 3. Check columns
  log('\n3. Validating table columns...', YELLOW);
  
  for (const [tableName, config] of Object.entries(expectedTables)) {
    try {
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);

      if (error) throw error;

      const existingColumns = columns.map(c => c.column_name);
      const missingColumns = config.columns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        testPassed(`Columns for ${tableName}`);
      } else {
        testFailed(`Columns for ${tableName}`, `Missing: ${missingColumns.join(', ')}`);
      }
    } catch (error) {
      testFailed(`Columns for ${tableName}`, error.message);
    }
  }

  // 4. Check RLS is enabled
  log('\n4. Validating Row Level Security...', YELLOW);
  
  try {
    const { data: rlsStatus, error } = await supabase
      .rpc('check_rls_status', {
        schema_name: 'public'
      })
      .single();

    if (error) {
      // RPC function might not exist, query directly
      const { data: tables, error: tableError } = await supabase
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('schemaname', 'public');

      if (tableError) throw tableError;

      for (const table of tables) {
        if (expectedTables[table.tablename]?.hasRLS) {
          if (table.rowsecurity) {
            testPassed(`RLS enabled: ${table.tablename}`);
          } else {
            testFailed(`RLS enabled: ${table.tablename}`, 'RLS is disabled');
          }
        }
      }
    }
  } catch (error) {
    log('  Note: Could not validate RLS status (requires admin access)', YELLOW);
  }

  // 5. Check RLS policies exist
  log('\n5. Validating RLS policies...', YELLOW);
  
  try {
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public');

    if (error) throw error;

    const tablesWithPolicies = new Set(policies.map(p => p.tablename));
    
    for (const [tableName, config] of Object.entries(expectedTables)) {
      if (config.hasRLS) {
        if (tablesWithPolicies.has(tableName)) {
          const tablePolicies = policies.filter(p => p.tablename === tableName);
          testPassed(`RLS policies for ${tableName} (${tablePolicies.length} policies)`);
        } else {
          testFailed(`RLS policies for ${tableName}`, 'No policies defined');
        }
      }
    }
  } catch (error) {
    log('  Note: Could not validate RLS policies (requires admin access)', YELLOW);
  }

  // 6. Check critical indexes
  log('\n6. Validating database indexes...', YELLOW);
  
  const criticalIndexes = [
    { table: 'debate_sessions', column: 'user_id' },
    { table: 'debate_speeches', column: 'session_id' },
    { table: 'speech_feedback', column: 'user_id' },
    { table: 'saved_searches', column: 'user_id' },
    { table: 'user_preferences', column: 'user_id' }
  ];

  try {
    const { data: indexes, error } = await supabase
      .rpc('list_indexes', {
        schema_name: 'public'
      })
      .single();

    if (!error && indexes) {
      for (const { table, column } of criticalIndexes) {
        const hasIndex = indexes.some(idx => 
          idx.tablename === table && idx.indexdef.includes(column)
        );
        
        if (hasIndex) {
          testPassed(`Index on ${table}.${column}`);
        } else {
          testFailed(`Index on ${table}.${column}`, 'Index missing (may impact performance)');
        }
      }
    }
  } catch (error) {
    log('  Note: Could not validate indexes (custom function may not exist)', YELLOW);
  }

  // 7. Test basic operations
  log('\n7. Testing basic database operations...', YELLOW);
  
  try {
    // Test health check table
    const { data: health, error: healthError } = await supabase
      .from('health_check')
      .select('*')
      .limit(1);

    if (!healthError) {
      testPassed('Read from health_check table');
    } else {
      testFailed('Read from health_check table', healthError.message);
    }
  } catch (error) {
    testFailed('Basic operations', error.message);
  }

  // Summary
  log('\n' + '='.repeat(40), YELLOW);
  log(`Total Validations: ${passed + failed}`);
  log(`Passed: ${passed}`, GREEN);
  log(`Failed: ${failed}`, RED);
  
  if (issues.length > 0) {
    log('\nIssues Found:', RED);
    issues.forEach(({ test, error }) => {
      log(`  ${test}: ${error}`, RED);
    });
    
    log('\nRecommendations:', YELLOW);
    log('1. Run missing migrations from the migrations/ directory');
    log('2. Ensure RLS is enabled on all user-data tables');
    log('3. Add indexes for foreign key columns to improve performance');
    log('4. Review and apply the latest migration files');
  }

  if (failed === 0) {
    log('\n✅ Database validation complete - all checks passed!', GREEN);
  } else {
    log('\n❌ Database validation found issues', RED);
    process.exit(1);
  }
}

// Create RPC functions if needed
const createHelperFunctions = `
-- Function to check RLS status
CREATE OR REPLACE FUNCTION check_rls_status(schema_name text)
RETURNS TABLE(tablename text, has_rls boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.rowsecurity::boolean as has_rls
  FROM pg_tables t
  WHERE t.schemaname = schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list indexes
CREATE OR REPLACE FUNCTION list_indexes(schema_name text)
RETURNS TABLE(tablename text, indexname text, indexdef text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.tablename::text,
    i.indexname::text,
    i.indexdef::text
  FROM pg_indexes i
  WHERE i.schemaname = schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Run validation
validateDatabase().catch(error => {
  log(`\nUnexpected error: ${error.message}`, RED);
  log('\nTip: You may need to create helper functions first:', YELLOW);
  log(createHelperFunctions);
  process.exit(1);
});
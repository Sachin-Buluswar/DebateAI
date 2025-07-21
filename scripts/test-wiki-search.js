#!/usr/bin/env node

/**
 * Atlas Debate - Wiki Search Integration Test
 * Tests the wiki search and RAG functionality
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
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
const errors = [];

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
  errors.push({ test: testName, error });
  log(`✗ ${testName}`, RED);
  if (error) log(`  Error: ${error}`, RED);
}

async function makeAuthenticatedRequest(url, options = {}, authToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  const data = await response.json();
  return { response, data };
}

// Main test function
async function runWikiSearchTests() {
  log('\n🧪 Wiki Search Integration Test', YELLOW);
  log('================================\n', YELLOW);

  // 1. Check environment
  log('1. Testing environment setup...', YELLOW);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    testFailed('Environment check', 'Missing Supabase credentials');
    return;
  }
  
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasVectorStore = !!process.env.OPENAI_VECTOR_STORE_ID;
  
  if (hasOpenAI && hasVectorStore) {
    testPassed('OpenAI configuration present');
  } else {
    log('⚠️  OpenAI not fully configured (search may be limited)', YELLOW);
  }

  // 2. Test unauthenticated requests
  log('\n2. Testing unauthenticated access...', YELLOW);
  
  // Wiki search should require auth
  const { response: wikiResponse } = await makeAuthenticatedRequest(
    `${API_URL}/api/wiki-search`,
    {
      method: 'POST',
      body: JSON.stringify({ query: 'test query' })
    }
  );
  
  if (wikiResponse.status === 401) {
    testPassed('Wiki search requires authentication');
  } else {
    testFailed('Wiki search auth check', `Expected 401, got ${wikiResponse.status}`);
  }
  
  // RAG search doesn't require auth but needs vector store
  const { response: ragResponse, data: ragData } = await makeAuthenticatedRequest(
    `${API_URL}/api/wiki-rag-search`,
    {
      method: 'POST',
      body: JSON.stringify({ query: 'test query' })
    }
  );
  
  if (ragResponse.status === 200 || ragResponse.status === 503) {
    testPassed('RAG search endpoint accessible');
    if (ragResponse.status === 503) {
      log('  Note: Vector store not configured', YELLOW);
    }
  } else {
    testFailed('RAG search accessibility', `Unexpected status ${ragResponse.status}`);
  }

  // 3. Authenticate and test with auth
  log('\n3. Testing authenticated access...', YELLOW);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Try to use existing session or create test account
  let session = null;
  const testEmail = 'wikitest@atlasdebate.com';
  const testPassword = 'wikitestpass123';
  
  try {
    // Try sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      // Create account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword
      });
      
      if (!signUpError) {
        // Sign in with new account
        const { data: newAuth } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        session = newAuth?.session;
      }
    } else {
      session = authData.session;
    }
    
    if (session) {
      testPassed('Authentication successful');
    } else {
      testFailed('Authentication', 'Could not obtain session');
      return;
    }
  } catch (error) {
    testFailed('Authentication', error.message);
    return;
  }

  // 4. Test wiki search with authentication
  log('\n4. Testing wiki search functionality...', YELLOW);
  
  const searchQueries = [
    { query: 'climate change', description: 'Standard search' },
    { query: 'AI', description: 'Short query' },
    { query: 'nuclear energy pros and cons', description: 'Complex query' }
  ];
  
  for (const { query, description } of searchQueries) {
    const { response, data } = await makeAuthenticatedRequest(
      `${API_URL}/api/wiki-search`,
      {
        method: 'POST',
        body: JSON.stringify({ query, maxResults: 5 })
      },
      session.access_token
    );
    
    if (response.status === 200 && data.results) {
      testPassed(`Wiki search: ${description}`);
      log(`  Found ${data.results.length} results`);
    } else if (response.status === 503) {
      testFailed(`Wiki search: ${description}`, 'Service unavailable (check OpenAI config)');
    } else {
      testFailed(`Wiki search: ${description}`, data.error || `Status ${response.status}`);
    }
  }

  // 5. Test wiki generate endpoint
  log('\n5. Testing wiki content generation...', YELLOW);
  
  const { response: genResponse, data: genData } = await makeAuthenticatedRequest(
    `${API_URL}/api/wiki-generate`,
    {
      method: 'POST',
      body: JSON.stringify({ 
        query: 'renewable energy benefits',
        maxTokens: 500
      })
    },
    session.access_token
  );
  
  if (genResponse.status === 200 && genData.answer) {
    testPassed('Wiki content generation');
    log(`  Generated ${genData.answer.length} characters`);
  } else if (genResponse.status === 503) {
    testFailed('Wiki content generation', 'Service unavailable');
  } else {
    testFailed('Wiki content generation', genData.error || `Status ${genResponse.status}`);
  }

  // 6. Test RAG search with auth
  log('\n6. Testing RAG search with context...', YELLOW);
  
  const { response: ragAuthResponse, data: ragAuthData } = await makeAuthenticatedRequest(
    `${API_URL}/api/wiki-rag-search`,
    {
      method: 'POST',
      body: JSON.stringify({ 
        query: 'quantum computing applications',
        maxResults: 3
      })
    },
    session.access_token
  );
  
  if (ragAuthResponse.status === 200 && ragAuthData.results) {
    testPassed('RAG search with authentication');
    log(`  Retrieved ${ragAuthData.results.length} document chunks`);
    
    // Check result structure
    const firstResult = ragAuthData.results[0];
    if (firstResult && firstResult.content && firstResult.metadata) {
      testPassed('RAG result structure valid');
    } else {
      testFailed('RAG result structure', 'Missing expected fields');
    }
  } else {
    testFailed('RAG search', ragAuthData.error || `Status ${ragAuthResponse.status}`);
  }

  // 7. Test search within debate context
  log('\n7. Testing wiki panel integration...', YELLOW);
  
  // This would typically be done through the UI, but we can test the API
  const debateContext = {
    query: 'statistics on renewable energy growth',
    debateTopic: 'Renewable energy should replace fossil fuels',
    userSide: 'PRO'
  };
  
  const { response: contextResponse, data: contextData } = await makeAuthenticatedRequest(
    `${API_URL}/api/wiki-search`,
    {
      method: 'POST',
      body: JSON.stringify({ 
        query: debateContext.query,
        context: debateContext
      })
    },
    session.access_token
  );
  
  if (contextResponse.status === 200) {
    testPassed('Wiki search with debate context');
  } else {
    testFailed('Wiki search with context', `Status ${contextResponse.status}`);
  }

  // Summary
  log('\n' + '='.repeat(40), YELLOW);
  log(`Total Tests: ${passed + failed}`);
  log(`Passed: ${passed}`, GREEN);
  log(`Failed: ${failed}`, RED);
  
  if (errors.length > 0) {
    log('\nErrors:', RED);
    errors.forEach(({ test, error }) => {
      log(`  ${test}: ${error}`, RED);
    });
  }

  if (failed === 0) {
    log('\n✅ All wiki search tests passed!', GREEN);
  } else {
    log('\n❌ Some tests failed', RED);
    
    if (!hasOpenAI || !hasVectorStore) {
      log('\n💡 Tip: Configure OpenAI API key and Vector Store ID for full functionality', YELLOW);
    }
  }
  
  // Cleanup
  await supabase.auth.signOut();
}

// Run tests
runWikiSearchTests().catch(error => {
  log(`\nUnexpected error: ${error.message}`, RED);
  process.exit(1);
});
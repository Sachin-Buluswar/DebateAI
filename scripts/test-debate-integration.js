#!/usr/bin/env node

/**
 * DebateAI - Debate Integration Test
 * Tests the full debate flow from start to finish
 */

const io = require('socket.io-client');
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

// Main test function
async function runDebateTests() {
  log('\n🧪 DebateAI Integration Test', YELLOW);
  log('============================\n', YELLOW);

  // 1. Check environment
  log('1. Checking environment variables...', YELLOW);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    testFailed('Environment check', 'Missing Supabase credentials');
    return;
  }
  testPassed('Environment variables present');

  // 2. Create Supabase client and authenticate
  log('\n2. Testing authentication...', YELLOW);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Use a test account or create one
  const testEmail = 'test@debateai.com';
  const testPassword = 'testpassword123';
  
  let session = null;
  
  // Try to sign in first
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authError) {
    // Try to create the account if it doesn't exist
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (signUpError) {
      testFailed('Authentication', signUpError.message);
      log('\nNote: You need to set up a test account or use existing credentials', YELLOW);
      return;
    }
    testPassed('Test account created');
    
    // Now sign in with the newly created account
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      testFailed('Sign in after signup', signInError.message);
      return;
    }
    
    session = signInData.session;
  } else {
    testPassed('Authentication successful');
    session = authData.session;
  }
  if (!session) {
    testFailed('Session retrieval', 'No session available');
    return;
  }

  // 3. Initialize Socket.IO connection
  log('\n3. Testing Socket.IO connection...', YELLOW);
  
  // First, fetch the socketio endpoint to initialize it
  try {
    await fetch(`${API_URL}/api/socketio`);
    testPassed('Socket.IO endpoint initialized');
  } catch (error) {
    testFailed('Socket.IO endpoint initialization', error.message);
    return;
  }

  const socket = io(API_URL, {
    path: '/api/socketio',
    auth: {
      token: session.access_token
    },
    transports: ['websocket', 'polling']
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      testPassed('Socket.IO connected');
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  }).catch(error => {
    testFailed('Socket.IO connection', error.message);
    socket.disconnect();
    return;
  });

  // 4. Test starting a debate
  log('\n4. Testing debate initialization...', YELLOW);
  
  const testDebateConfig = {
    topic: 'Should AI be regulated by governments?',
    participants: [
      { id: 'human-pro-1', name: 'Test User', isAI: false, team: 'PRO', role: 'SPEAKER_1' },
      { id: 'ai-pro-2', name: 'Emily Carter', isAI: true, team: 'PRO', role: 'SPEAKER_2' },
      { id: 'ai-con-1', name: 'Marcus Johnson', isAI: true, team: 'CON', role: 'SPEAKER_1' },
      { id: 'ai-con-2', name: 'Sophia Chen', isAI: true, team: 'CON', role: 'SPEAKER_2' }
    ]
  };

  // Set up event listeners
  let debateStarted = false;
  let speechGenerated = false;
  let audioReceived = false;
  const receivedPhases = new Set();

  socket.on('debateStateUpdate', (state, mode) => {
    if (!debateStarted) {
      debateStarted = true;
      testPassed('Debate started successfully');
    }
    receivedPhases.add(state.phase);
    log(`  Phase: ${state.phase}, Speaker: ${state.currentSpeakerId}`, YELLOW);
  });

  socket.on('aiSpeech', (data) => {
    speechGenerated = true;
    testPassed('AI speech generated');
    log(`  Speaker: ${data.speakerName}, Length: ${data.text.length} chars`);
  });

  socket.on('audioChunk', (data) => {
    if (!audioReceived) {
      audioReceived = true;
      testPassed('Audio stream received');
    }
  });

  socket.on('error', (error) => {
    testFailed('Socket error', error.message || error);
  });

  // Start the debate
  socket.emit('startDebate', testDebateConfig);

  // Wait for debate to progress
  await new Promise(resolve => setTimeout(resolve, 15000));

  // 5. Check results
  log('\n5. Checking test results...', YELLOW);
  
  if (debateStarted) {
    testPassed('Debate initialization');
  } else {
    testFailed('Debate initialization', 'No state updates received');
  }

  if (speechGenerated) {
    testPassed('AI speech generation');
  } else {
    testFailed('AI speech generation', 'No AI speeches received');
  }

  if (audioReceived) {
    testPassed('Audio streaming');
  } else {
    testFailed('Audio streaming', 'No audio chunks received');
  }

  if (receivedPhases.size > 0) {
    testPassed(`Phase transitions (${receivedPhases.size} phases)`);
  } else {
    testFailed('Phase transitions', 'No phase changes detected');
  }

  // Disconnect
  socket.disconnect();

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
    log('\n✅ All tests passed!', GREEN);
  } else {
    log('\n❌ Some tests failed', RED);
    process.exit(1);
  }
}

// Run tests
runDebateTests().catch(error => {
  log(`\nUnexpected error: ${error.message}`, RED);
  process.exit(1);
});
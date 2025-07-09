#!/usr/bin/env node

/**
 * Test script to verify all API endpoints are working
 * Run with: node scripts/test-endpoints.js
 */

const fetch = require('node-fetch');
const axios = require('axios');
const chalk = require('chalk');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/health', expected: 200, name: 'Health Check' },
  { method: 'GET', path: '/api/test', expected: 200, name: 'Test Endpoint' },
  { method: 'POST', path: '/api/speech-feedback', expected: 401, name: 'Speech Feedback (Auth Required)', body: new FormData() },
  { method: 'POST', path: '/api/wiki-search', expected: 401, name: 'Wiki Search (Auth Required)', body: { query: 'test' } },
  { method: 'POST', path: '/api/prototype/openai-argument', expected: 200, name: 'OpenAI Argument', body: { topic: 'test', stance: 'pro' } },
  { method: 'POST', path: '/api/prototype/elevenlabs-tts', expected: 200, name: 'ElevenLabs TTS', body: { text: 'test' } },
];

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: endpoint.body instanceof FormData ? {} : {
      'Content-Type': 'application/json',
    },
    body: endpoint.body instanceof FormData ? endpoint.body : 
          endpoint.body ? JSON.stringify(endpoint.body) : undefined,
  };

  try {
    const start = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    
    const success = response.status === endpoint.expected;
    const symbol = success ? '✅' : '❌';
    
    console.log(`${symbol} ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    console.log(`   Status: ${response.status} (expected ${endpoint.expected})`);
    console.log(`   Time: ${duration}ms`);
    
    if (!success) {
      const body = await response.text();
      console.log(`   Response: ${body.substring(0, 100)}...`);
    }
    
    console.log('');
    return success;
  } catch (error) {
    console.log(`❌ ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    return false;
  }
}

async function runTests() {
  console.log(`\nTesting API endpoints at ${BASE_URL}\n`);
  console.log('=' .repeat(50));
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  for (const endpoint of API_ENDPOINTS) {
    const success = await testEndpoint(endpoint);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('=' .repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  
  // Test WebSocket connection
  console.log('Testing WebSocket connection...');
  try {
    const io = require('socket.io-client');
    const socket = io(BASE_URL, {
      path: '/api/socketio',
      transports: ['polling', 'websocket'],
      reconnection: false,
      timeout: 10000,
      auth: {
        token: null // anonymous connection for testing
      }
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      console.log('   Socket ID:', socket.id);
      console.log('   Transport:', socket.io.engine.transport.name);
      socket.disconnect();
      process.exit(failed > 0 ? 1 : 0);
    });
    
    socket.on('connect_error', (error) => {
      console.log('❌ WebSocket connection failed:', error.message);
      console.log('   Error type:', error.type);
      process.exit(1);
    });
    
    setTimeout(() => {
      console.log('❌ WebSocket connection timeout');
      console.log('   Socket readyState:', socket.io.readyState);
      socket.disconnect();
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.log('❌ WebSocket test failed:', error.message);
    console.log('   Make sure socket.io-client is installed: npm install socket.io-client');
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Check if server is running
fetch(`${BASE_URL}/api/health`)
  .then(() => runTests())
  .catch(() => {
    console.error(`\n❌ Server is not running at ${BASE_URL}`);
    console.error('   Please start the server with: npm run dev\n');
    process.exit(1);
  }); 
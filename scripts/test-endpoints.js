#!/usr/bin/env node

/**
 * Test script to verify all API endpoints are working
 * Run with: node scripts/test-endpoints.js
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/health', expected: 200, name: 'Health Check' },
  { method: 'GET', path: '/api/monitoring/health', expected: 200, name: 'Monitoring Health' },
  { method: 'POST', path: '/api/wiki-search', expected: 401, name: 'Wiki Search (Auth Required)', body: { query: 'test' } },
  { method: 'GET', path: '/api/user-preferences', expected: 401, name: 'User Preferences (Auth Required)' },
  { method: 'GET', path: '/api/user-profiles', expected: 401, name: 'User Profiles (Auth Required)' },
  { method: 'GET', path: '/api/resources', expected: 200, name: 'Learning Resources' },
];

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' },
    body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
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
  console.log('='.repeat(50));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const endpoint of API_ENDPOINTS) {
    const success = await testEndpoint(endpoint);
    if (success) passed++;
    else failed++;
  }

  console.log('='.repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
fetch(`${BASE_URL}/api/health`)
  .then(() => runTests())
  .catch(() => {
    console.error(`\n❌ Server is not running at ${BASE_URL}`);
    console.error('   Please start the server with: npm run dev\n');
    process.exit(1);
  });

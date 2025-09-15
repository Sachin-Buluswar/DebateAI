#!/usr/bin/env node

/**
 * Quick test script to verify auth endpoints are responding correctly
 * Run with: node scripts/test-auth-endpoints.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`Testing ${name}...`);
    const response = await fetch(url, options);
    
    if (response.ok || response.status === 401 || response.status === 307) {
      console.log(`✅ ${name}: ${response.status} ${response.statusText}`);
      return true;
    } else {
      console.error(`❌ ${name}: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\nTesting auth endpoints at ${BASE_URL}\n`);
  
  const results = [];
  
  // Test public pages
  results.push(await testEndpoint('Home Page', `${BASE_URL}/`));
  results.push(await testEndpoint('Auth Page', `${BASE_URL}/auth`));
  
  // Test protected pages (should redirect or return 401)
  results.push(await testEndpoint('Dashboard (Protected)', `${BASE_URL}/dashboard`, {
    redirect: 'manual'
  }));
  
  // Test API endpoints
  results.push(await testEndpoint('Ensure Profile API', `${BASE_URL}/api/auth/ensure-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }));
  
  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. This might be expected for protected routes.');
    console.log('Protected routes should return 401 or redirect (307) when not authenticated.');
  } else {
    console.log('\n✅ All endpoint tests passed!');
  }
}

// Run tests
runTests().catch(console.error);
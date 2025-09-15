#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script helps verify that authentication is working properly after the fixes.
 * Run with: node test-auth.js
 */

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          url: url
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkEndpoint(path, description) {
  const url = `${BASE_URL}${path}`;
  
  try {
    log(`\nTesting: ${description}`, colors.cyan);
    log(`URL: ${url}`, colors.blue);
    
    const response = await makeRequest(url, {
      headers: {
        'User-Agent': 'AuthTestScript/1.0'
      }
    });
    
    if (response.statusCode === 200) {
      log(`✓ Success: ${response.statusCode}`, colors.green);
      
      // Check for specific issues in the response
      if (response.body.includes('Checking authentication...') && 
          !response.body.includes('error') && 
          !response.body.includes('Error')) {
        log(`⚠ Warning: Page might be stuck on "Checking authentication..."`, colors.yellow);
      }
    } else if (response.statusCode === 302 || response.statusCode === 307) {
      log(`→ Redirect: ${response.statusCode} to ${response.headers.location}`, colors.yellow);
      
      // Check if it's redirecting to auth page (expected for protected routes)
      if (response.headers.location?.includes('/auth')) {
        log(`✓ Correctly redirecting to auth page for protected route`, colors.green);
      }
    } else {
      log(`✗ Unexpected status: ${response.statusCode}`, colors.red);
    }
    
    return response;
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    return null;
  }
}

async function runTests() {
  log('\n=================================', colors.cyan);
  log('    Authentication Test Suite    ', colors.cyan);
  log('=================================\n', colors.cyan);
  
  log(`Testing server at: ${BASE_URL}`, colors.blue);
  log('Please ensure the Next.js dev server is running\n', colors.yellow);
  
  // Test public pages
  log('\n--- PUBLIC PAGES ---', colors.cyan);
  await checkEndpoint('/', 'Landing page (public)');
  await checkEndpoint('/auth', 'Auth page (should load without issues)');
  await checkEndpoint('/about', 'About page (public)');
  await checkEndpoint('/privacy', 'Privacy page (public)');
  
  // Test protected pages (should redirect to auth)
  log('\n--- PROTECTED PAGES ---', colors.cyan);
  await checkEndpoint('/dashboard', 'Dashboard (should redirect to auth)');
  await checkEndpoint('/debate', 'Debate page (should redirect to auth)');
  await checkEndpoint('/search', 'Search page (should redirect to auth)');
  await checkEndpoint('/preferences', 'Preferences (should redirect to auth)');
  
  // Test API endpoints
  log('\n--- API ENDPOINTS ---', colors.cyan);
  await checkEndpoint('/api/health_check', 'Health check endpoint');
  await checkEndpoint('/api/search-status', 'Search status endpoint');
  
  log('\n=================================', colors.cyan);
  log('    Test Complete    ', colors.cyan);
  log('=================================\n', colors.cyan);
  
  log('NEXT STEPS:', colors.yellow);
  log('1. Test login manually in a regular browser window', colors.reset);
  log('2. Test login in an incognito/private window', colors.reset);
  log('3. Clear browser cookies and test again', colors.reset);
  log('4. Check browser console for any JavaScript errors', colors.reset);
  log('5. Check Network tab in DevTools for failed requests', colors.reset);
  
  log('\nIf issues persist:', colors.yellow);
  log('- Check Supabase Dashboard for auth configuration', colors.reset);
  log('- Verify environment variables are correctly set', colors.reset);
  log('- Check server logs for any error messages', colors.reset);
}

// Run the tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, colors.red);
  process.exit(1);
});
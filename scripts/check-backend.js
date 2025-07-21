#!/usr/bin/env node

/**
 * Eris Debate - Backend Connection Test Utility
 * 
 * This script tests the connection to the backend API server.
 * It will report if the backend is reachable and if it's working correctly.
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function checkBackendConnection() {
  console.log(`${colors.cyan}Eris Debate Backend Connection Test${colors.reset}`);
  console.log('-----------------------------------');
  
  // Get the backend API URL from environment variables
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  
  if (!backendUrl) {
    console.error(`${colors.red}Error: BACKEND_API_URL or NEXT_PUBLIC_API_URL not set in environment variables.${colors.reset}`);
    console.log('Please check your .env or .env.local file and set one of these variables.');
    process.exit(1);
  }
  
  console.log(`${colors.blue}Backend URL:${colors.reset} ${backendUrl}`);
  
  try {
    // Try to fetch the health endpoint (or any simple endpoint)
    const healthEndpoint = `${backendUrl}/api/health`;
    console.log(`${colors.blue}Testing connection to:${colors.reset} ${healthEndpoint}`);
    
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      console.log(`${colors.green}✅ Backend is reachable and responding.${colors.reset}`);
      const data = await response.json();
      console.log(`${colors.blue}Response:${colors.reset}`, data);
    } else {
      console.log(`${colors.yellow}⚠️ Backend is reachable but returned status ${response.status}.${colors.reset}`);
      try {
        const errorData = await response.text();
        console.log(`${colors.blue}Error response:${colors.reset}`, errorData);
      } catch (parseError) {
        console.log(`${colors.yellow}Could not parse error response.${colors.reset}`);
      }
    }
    
    // Now try the speech-feedback endpoint with a basic check (not sending a file)
    console.log('\n-----------------------------------');
    console.log(`${colors.blue}Testing speech feedback API:${colors.reset} ${backendUrl}/api/speech-feedback`);
    
    const speechResponse = await fetch(`${backendUrl}/api/speech-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: true }),
      timeout: 5000
    });
    
    if (speechResponse.status === 400 || speechResponse.status === 405) {
      console.log(`${colors.green}✅ Speech feedback API is reachable.${colors.reset}`);
      try {
        const speechData = await speechResponse.json();
        console.log(`${colors.blue}Response (${speechResponse.status}):${colors.reset}`, speechData);
      } catch (parseError) {
        console.log(`${colors.yellow}Could not parse response.${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}⚠️ Speech feedback API returned unexpected status ${speechResponse.status}.${colors.reset}`);
      try {
        const errorData = await speechResponse.text();
        console.log(`${colors.blue}Error response:${colors.reset}`, errorData);
      } catch (parseError) {
        console.log(`${colors.yellow}Could not parse error response.${colors.reset}`);
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Error connecting to backend:${colors.reset}`, error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}The backend server appears to be down or not listening on the expected port.${colors.reset}`);
      console.log(`${colors.yellow}Make sure the backend server is running and accessible at ${backendUrl}.${colors.reset}`);
    } else if (error.code === 'ETIMEDOUT' || error.type === 'request-timeout') {
      console.log(`${colors.yellow}Connection to backend timed out.${colors.reset}`);
      console.log(`${colors.yellow}Check if the backend server is overloaded or if network issues are preventing connection.${colors.reset}`);
    }
  }
  
  console.log('\n-----------------------------------');
  console.log(`${colors.cyan}Environment Check:${colors.reset}`);
  console.log(`BACKEND_API_URL: ${process.env.BACKEND_API_URL || '(not set)'}`);
  console.log(`NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || '(not set)'}`);
  console.log(`PORT: ${process.env.PORT || '(not set)'}`);
}

checkBackendConnection().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
}); 
#!/usr/bin/env node

/**
 * RAG System Critical Bug Test
 * Tests all components of the RAG system to identify critical issues
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  criticalIssues: []
};

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function testPassed(testName) {
  testResults.passed++;
  log(`✅ ${testName}`, GREEN);
}

function testFailed(testName, error, isCritical = false) {
  testResults.failed++;
  log(`❌ ${testName}`, RED);
  if (error) log(`   Error: ${error}`, RED);
  
  if (isCritical) {
    testResults.criticalIssues.push({ test: testName, error });
  }
}

function testWarning(testName, warning) {
  testResults.warnings++;
  log(`⚠️  ${testName}`, YELLOW);
  if (warning) log(`   Warning: ${warning}`, YELLOW);
}

async function testEnvironmentConfiguration() {
  log('\n🔧 Testing Environment Configuration...', BLUE);
  log('=====================================', BLUE);

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'OPENAI_VECTOR_STORE_ID'
  ];

  const missingVars = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length === 0) {
    testPassed('All required environment variables present');
  } else {
    testFailed('Missing environment variables', missingVars.join(', '), true);
  }

  // Test OpenAI API connection
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const models = await openai.models.list();
      if (models.data && models.data.length > 0) {
        testPassed('OpenAI API connection successful');
      } else {
        testFailed('OpenAI API connection', 'No models returned', true);
      }
    } catch (error) {
      testFailed('OpenAI API connection', error.message, true);
    }
  }

  // Test Supabase connection
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabase.from('documents').select('count', { count: 'exact', head: true });
      if (!error) {
        testPassed('Supabase database connection successful');
      } else {
        testFailed('Supabase database connection', error.message, true);
      }
    } catch (error) {
      testFailed('Supabase connection', error.message, true);
    }
  }
}

async function testDatabaseSchema() {
  log('\n🗄️  Testing Database Schema...', BLUE);
  log('==============================', BLUE);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    testFailed('Database schema check', 'Missing Supabase credentials', true);
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const requiredTables = ['documents', 'document_chunks', 'opencaselist_scrape_log', 'search_results_cache'];

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (!error) {
        testPassed(`Table '${table}' exists and accessible`);
      } else {
        testFailed(`Table '${table}' check`, error.message, table === 'documents' || table === 'document_chunks');
      }
    } catch (error) {
      testFailed(`Table '${table}' check`, error.message, true);
    }
  }

  // Test document insertion (basic write operation)
  try {
    const testDoc = {
      title: 'RAG Test Document',
      file_name: 'test.pdf',
      file_url: 'https://example.com/test.pdf',
      source_type: 'other',
      metadata: { test: true }
    };

    const { data, error } = await supabase.from('documents').insert(testDoc).select().single();
    
    if (!error && data) {
      testPassed('Document insertion works');
      
      // Clean up test document
      await supabase.from('documents').delete().eq('id', data.id);
    } else {
      testFailed('Document insertion', error?.message, true);
    }
  } catch (error) {
    testFailed('Document insertion test', error.message, true);
  }
}

async function testDocumentStorageService() {
  log('\n📁 Testing Document Storage Service...', BLUE);
  log('=====================================', BLUE);

  try {
    // Import the service (this tests if the module loads without errors)
    const { DocumentStorageService } = require('./src/backend/services/documentStorageService.ts');
    
    testFailed('DocumentStorageService import', 'TypeScript files cannot be required directly');
  } catch (error) {
    if (error.message.includes('TypeScript')) {
      testWarning('DocumentStorageService import', 'TypeScript files need compilation first');
    } else {
      testFailed('DocumentStorageService import', error.message, true);
    }
  }

  // Test service indirectly through API endpoints
  log('Testing service functionality through API...');
  
  // This would require the server to be running
  testWarning('DocumentStorageService functionality', 'Cannot test without running server');
}

async function testAPIEndpoints() {
  log('\n🌐 Testing API Endpoints...', BLUE);
  log('===========================', BLUE);

  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  
  const endpoints = [
    { path: '/api/health', method: 'GET', requiresAuth: false },
    { path: '/api/wiki-rag-search-enhanced', method: 'POST', requiresAuth: false },
    { path: '/api/admin/upload-document', method: 'POST', requiresAuth: true },
    { path: '/api/admin/scrape-opencaselist', method: 'POST', requiresAuth: true },
    { path: '/api/admin/scrape-status', method: 'GET', requiresAuth: true }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: endpoint.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: endpoint.method === 'POST' ? JSON.stringify({ query: 'test' }) : undefined
      });

      if (response.status < 500) {
        testPassed(`Endpoint ${endpoint.path} is reachable`);
      } else {
        testFailed(`Endpoint ${endpoint.path}`, `Server error: ${response.status}`, true);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        testWarning(`Endpoint ${endpoint.path}`, 'Server not running - cannot test API endpoints');
        break; // No point testing other endpoints if server is down
      } else {
        testFailed(`Endpoint ${endpoint.path}`, error.message, true);
      }
    }
  }
}

async function testOpenAIVectorStore() {
  log('\n🤖 Testing OpenAI Vector Store...', BLUE);
  log('=================================', BLUE);

  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_VECTOR_STORE_ID) {
    testFailed('Vector store test', 'Missing OpenAI credentials', true);
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Check if vector store exists
    const vectorStore = await openai.beta.vectorStores.retrieve(process.env.OPENAI_VECTOR_STORE_ID);
    
    if (vectorStore && vectorStore.id) {
      testPassed('Vector store exists and accessible');
      log(`   Vector store name: ${vectorStore.name || 'Unnamed'}`);
      log(`   File count: ${vectorStore.file_counts?.total || 0}`);
    } else {
      testFailed('Vector store access', 'Invalid vector store response', true);
    }
  } catch (error) {
    testFailed('Vector store access', error.message, true);
  }
}

async function testPDFProcessing() {
  log('\n📄 Testing PDF Processing Dependencies...', BLUE);
  log('========================================', BLUE);

  try {
    const pdfParse = require('pdf-parse');
    testPassed('pdf-parse module available');
  } catch (error) {
    testFailed('pdf-parse dependency', error.message, true);
  }

  try {
    const puppeteer = require('puppeteer');
    testPassed('puppeteer module available');
  } catch (error) {
    testFailed('puppeteer dependency', error.message, true);
  }

  try {
    const fetch = require('node-fetch');
    testPassed('node-fetch module available');
  } catch (error) {
    testFailed('node-fetch dependency', error.message, true);
  }
}

async function testValidationMiddleware() {
  log('\n🛡️  Testing Validation Middleware...', BLUE);
  log('===================================', BLUE);

  try {
    const { validationSchemas } = require('./src/middleware/inputValidation.ts');
    testFailed('Validation middleware import', 'TypeScript files cannot be required directly');
  } catch (error) {
    if (error.message.includes('TypeScript')) {
      testWarning('Validation middleware', 'TypeScript files need compilation first');
    } else {
      testFailed('Validation middleware import', error.message, true);
    }
  }

  // Test Zod dependency
  try {
    const z = require('zod');
    testPassed('Zod validation library available');
  } catch (error) {
    testFailed('Zod dependency', error.message, true);
  }
}

async function generateReport() {
  log('\n📊 Test Results Summary', BLUE);
  log('=======================', BLUE);
  
  log(`\nTotal Tests Run: ${testResults.passed + testResults.failed + testResults.warnings}`);
  log(`✅ Passed: ${testResults.passed}`, GREEN);
  log(`❌ Failed: ${testResults.failed}`, RED);
  log(`⚠️  Warnings: ${testResults.warnings}`, YELLOW);

  if (testResults.criticalIssues.length > 0) {
    log('\n🚨 CRITICAL ISSUES FOUND:', RED);
    log('========================', RED);
    
    testResults.criticalIssues.forEach((issue, index) => {
      log(`${index + 1}. ${issue.test}`, RED);
      log(`   ${issue.error}`, RED);
    });

    log('\n💡 Recommendations:', YELLOW);
    log('1. Fix all critical issues before deploying RAG system');
    log('2. Ensure all environment variables are properly configured');
    log('3. Verify database schema and permissions');
    log('4. Test with actual PDF documents before production use');
  } else if (testResults.failed > 0) {
    log('\n⚠️  Some tests failed but no critical issues found', YELLOW);
  } else {
    log('\n🎉 All critical components appear to be working!', GREEN);
  }

  return testResults.criticalIssues.length === 0;
}

async function runAllTests() {
  log('🔍 RAG System Critical Bug Test', BLUE);
  log('================================', BLUE);
  log('Testing all RAG system components for critical issues...\n');

  await testEnvironmentConfiguration();
  await testDatabaseSchema();
  await testDocumentStorageService();
  await testAPIEndpoints();
  await testOpenAIVectorStore();
  await testPDFProcessing();
  await testValidationMiddleware();

  const allGood = await generateReport();
  
  if (!allGood) {
    log('\n❌ Critical issues found that would prevent RAG system from working', RED);
    process.exit(1);
  } else {
    log('\n✅ RAG system appears ready for use', GREEN);
    process.exit(0);
  }
}

// Run the tests
runAllTests().catch(error => {
  log(`\n💥 Unexpected error during testing: ${error.message}`, RED);
  console.error(error);
  process.exit(1);
});
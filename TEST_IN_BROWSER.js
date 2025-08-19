/**
 * BROWSER CONSOLE TEST SCRIPT
 * 
 * Instructions:
 * 1. Open your app in browser
 * 2. Open Developer Console (F12)
 * 3. Copy and paste this entire script
 * 4. Watch for results
 */

console.log('🧪 Starting Eris Debate Platform Tests...\n');

// Test results collector
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper to make test requests
async function testEndpoint(name, url, options = {}) {
  console.log(`Testing: ${name}...`);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.ok) {
      results.passed.push(`✅ ${name}: ${response.status}`);
      console.log(`✅ ${name} passed`);
      return await response.json();
    } else {
      const error = await response.text();
      results.failed.push(`❌ ${name}: ${response.status} - ${error.substring(0, 100)}`);
      console.error(`❌ ${name} failed:`, response.status);
      return null;
    }
  } catch (error) {
    results.failed.push(`❌ ${name}: ${error.message}`);
    console.error(`❌ ${name} error:`, error);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.group('🔐 Authentication Tests');
  
  // Test 1: Check if user is logged in
  const authTest = await testEndpoint(
    'Auth Status',
    '/api/user_profiles',
    { method: 'GET' }
  );
  
  if (!authTest) {
    console.warn('⚠️ Not logged in - some tests will fail');
    results.warnings.push('Not authenticated - please log in first');
  }
  
  console.groupEnd();
  
  console.group('📊 API Endpoint Tests');
  
  // Test 2: User preferences
  await testEndpoint(
    'User Preferences',
    '/api/user_preferences',
    { method: 'GET' }
  );
  
  // Test 3: Debate endpoints
  await testEndpoint(
    'Debate Status',
    '/api/debate/realtime',
    { method: 'GET' }
  );
  
  // Test 4: Search functionality
  await testEndpoint(
    'Search Status',
    '/api/search-status',
    { method: 'GET' }
  );
  
  // Test 5: RAG status
  await testEndpoint(
    'RAG System',
    '/api/rag-status',
    { method: 'GET' }
  );
  
  // Test 6: Health check
  await testEndpoint(
    'Health Check',
    '/api/health_check',
    { method: 'GET' }
  );
  
  console.groupEnd();
  
  console.group('🗄️ Database Connection Tests');
  
  // Test 7: Check Supabase connection
  if (window.supabase) {
    try {
      const { data, error } = await window.supabase
        .from('health_check')
        .select('*')
        .limit(1);
      
      if (error) {
        results.failed.push(`❌ Database Query: ${error.message}`);
        console.error('❌ Database query failed:', error);
      } else {
        results.passed.push('✅ Database Query: Connected');
        console.log('✅ Database connected');
      }
    } catch (e) {
      results.warnings.push('⚠️ Supabase client not available in window');
      console.warn('⚠️ Cannot test database directly from console');
    }
  } else {
    results.warnings.push('⚠️ Supabase client not found - this is normal');
  }
  
  console.groupEnd();
  
  // Print summary
  console.group('📋 TEST SUMMARY');
  
  console.log(`\n✅ PASSED: ${results.passed.length}`);
  results.passed.forEach(r => console.log(r));
  
  console.log(`\n❌ FAILED: ${results.failed.length}`);
  results.failed.forEach(r => console.log(r));
  
  console.log(`\n⚠️ WARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(r => console.log(r));
  
  console.groupEnd();
  
  // Overall status
  const totalTests = results.passed.length + results.failed.length;
  const passRate = results.passed.length / totalTests * 100;
  
  console.log('\n' + '='.repeat(50));
  if (results.failed.length === 0) {
    console.log('🎉 ALL TESTS PASSED! The app is working correctly.');
  } else if (passRate > 50) {
    console.log(`🟡 PARTIAL SUCCESS: ${passRate.toFixed(0)}% tests passed. Some issues remain.`);
  } else {
    console.log(`🔴 CRITICAL: Only ${passRate.toFixed(0)}% tests passed. Major issues detected.`);
  }
  console.log('='.repeat(50));
  
  // Recommendations
  console.log('\n📝 RECOMMENDATIONS:');
  if (results.failed.length > 0) {
    console.log('1. Check browser Network tab for detailed error responses');
    console.log('2. Look for permission denied errors in responses');
    console.log('3. Verify you are logged in');
    console.log('4. Check Supabase dashboard for error logs');
  }
  
  if (!authTest) {
    console.log('\n⚠️ Please log in and run tests again for complete results');
  }
  
  return results;
}

// Run tests
console.log('Starting tests in 1 second...\n');
setTimeout(() => {
  runAllTests().then(results => {
    window.testResults = results;
    console.log('\n💾 Test results saved to window.testResults');
  });
}, 1000);
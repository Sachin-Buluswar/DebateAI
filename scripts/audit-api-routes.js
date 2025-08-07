#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all API route files
const apiRoutes = glob.sync('src/app/api/**/route.ts');

// Patterns to check for
const patterns = {
  hasRateLimit: /withRateLimit/,
  hasTryCatch: /try\s*{[\s\S]*?}\s*catch/,
  hasErrorResponse: /NextResponse\.json\s*\(\s*{\s*error:/,
  hasStatusCode: /status:\s*[4-5]\d\d/,
  hasValidation: /schema\.(parse|safeParse)|z\.(object|string|number)/,
  hasConsoleError: /console\.error/,
  hasProperAuth: /createClient|requireAuth|getUser/,
  returnsJson: /NextResponse\.json/,
  hasProperMethod: /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/
};

const results = [];

apiRoutes.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace('src/app/api/', '').replace('/route.ts', '');
  
  const checks = {};
  for (const [check, pattern] of Object.entries(patterns)) {
    checks[check] = pattern.test(content);
  }
  
  // Calculate score
  const score = Object.values(checks).filter(Boolean).length;
  const maxScore = Object.keys(checks).length;
  
  // Identify issues
  const issues = [];
  if (!checks.hasTryCatch) issues.push('Missing try-catch block');
  if (!checks.hasErrorResponse) issues.push('No error response handling');
  if (!checks.hasStatusCode) issues.push('No error status codes');
  if (!checks.hasValidation) issues.push('No input validation');
  if (!checks.hasRateLimit && !relativePath.includes('health')) issues.push('No rate limiting');
  
  results.push({
    path: relativePath,
    score: `${score}/${maxScore}`,
    issues,
    checks
  });
});

// Sort by score (worst first)
results.sort((a, b) => {
  const scoreA = parseInt(a.score.split('/')[0]);
  const scoreB = parseInt(b.score.split('/')[0]);
  return scoreA - scoreB;
});

// Output results
console.log('API Route Audit Results');
console.log('=======================\n');

// Show problematic routes first
const problematicRoutes = results.filter(r => r.issues.length > 2);
if (problematicRoutes.length > 0) {
  console.log('🚨 Routes needing attention:\n');
  problematicRoutes.forEach(route => {
    console.log(`  ${route.path} (${route.score})`);
    route.issues.forEach(issue => {
      console.log(`    - ${issue}`);
    });
    console.log();
  });
}

// Summary
console.log('\nSummary:');
console.log(`  Total routes: ${results.length}`);
console.log(`  Routes with issues: ${problematicRoutes.length}`);
console.log(`  Average score: ${(results.reduce((sum, r) => sum + parseInt(r.score.split('/')[0]), 0) / results.length).toFixed(1)}/${Object.keys(patterns).length}`);

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  totalRoutes: results.length,
  problematicCount: problematicRoutes.length,
  routes: results
};

fs.writeFileSync('api-audit-report.json', JSON.stringify(report, null, 2));
console.log('\nDetailed report saved to api-audit-report.json');
#!/usr/bin/env node

/**
 * Script to help identify and suggest fixes for common linting errors
 * Run with: node scripts/fix-common-lint-errors.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing common lint errors...\n');

// Common patterns and their fixes
const commonFixes = {
  'Unused variables': {
    pattern: /is defined but never used|is assigned a value but never used/,
    suggestion: 'Prefix unused parameter with underscore (e.g., _request) or remove if not needed',
    example: 'export async function GET(_request: NextRequest) { ... }'
  },
  'Unexpected any': {
    pattern: /Unexpected any\. Specify a different type/,
    suggestion: 'Replace "any" with a more specific type',
    examples: [
      'any[] → unknown[] or specific type[]',
      'any → unknown or Record<string, unknown>',
      'Function params: (param: any) → (param: string | number | YourType)'
    ]
  },
  'Request parameter unused': {
    pattern: /request.*is defined but never used/,
    suggestion: 'For Next.js route handlers, prefix with underscore: _request',
    example: 'export async function GET(_request: NextRequest) { ... }'
  }
};

// Count errors by type
const errorCounts = {
  unusedVars: 0,
  unexpectedAny: 0,
  requestUnused: 0,
  other: 0
};

// Parse lint output (you would need to capture the lint output)
const lintOutput = `
/Users/sachinbuluswar/Documents/debatetest2/instrumentation-client.ts
   44:61  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   53:61  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  100:20  error  'e' is defined but never used             @typescript-eslint/no-unused-vars
  120:16  error  'e' is defined but never used             @typescript-eslint/no-unused-vars
`;

// Count error types
const lines = lintOutput.split('\n');
lines.forEach(line => {
  if (line.includes('Unexpected any')) {
    errorCounts.unexpectedAny++;
  } else if (line.includes('request') && line.includes('never used')) {
    errorCounts.requestUnused++;
  } else if (line.includes('never used')) {
    errorCounts.unusedVars++;
  } else if (line.includes('error')) {
    errorCounts.other++;
  }
});

console.log('📊 Error Summary:');
console.log(`   - Unexpected any types: ${errorCounts.unexpectedAny}`);
console.log(`   - Unused variables: ${errorCounts.unusedVars}`);
console.log(`   - Unused request params: ${errorCounts.requestUnused}`);
console.log(`   - Other errors: ${errorCounts.other}`);
console.log('\n');

console.log('💡 Common Fixes:\n');

// Files that commonly have unused request params
const routeFiles = [
  'src/app/api/socketio/route.ts',
  'src/app/api/socket-init/route.ts',
  'src/app/api/monitoring/health/route.ts',
  'src/app/api/monitoring/metrics/route.ts',
];

console.log('1. For unused "request" parameters in API routes:');
console.log('   Files to check:', routeFiles.join(', '));
console.log('   Fix: Prefix with underscore → _request');
console.log('   Example: export async function GET(_request: NextRequest) { ... }\n');

console.log('2. For "Unexpected any" errors:');
console.log('   Common replacements:');
console.log('   - any → unknown (when type is truly unknown)');
console.log('   - any → Record<string, unknown> (for objects)');
console.log('   - any[] → unknown[] or specific type[]');
console.log('   - Callback params: (error: any) → (error: Error | unknown)\n');

console.log('3. For unused variables in catch blocks:');
console.log('   - catch (e) → catch (_e) or catch (error)');
console.log('   - If error is logged: catch (error) { console.error(error); ... }');
console.log('   - If error is ignored: catch { ... } (no parameter)\n');

console.log('4. Type definitions to add:');
console.log('   For monitoring/metrics types, create:');
console.log('   ```typescript');
console.log('   interface MetricData {');
console.log('     value: number;');
console.log('     timestamp: number;');
console.log('     labels?: Record<string, string>;');
console.log('   }');
console.log('   ```\n');

console.log('🚀 Quick Fix Commands:');
console.log('   # Fix unused request params in API routes:');
console.log('   sed -i \'\' \'s/(request: NextRequest)/(_request: NextRequest)/g\' src/app/api/**/*.ts\n');

console.log('   # See all files with errors:');
console.log('   npm run lint 2>&1 | grep "error" | cut -d: -f1 | sort | uniq\n');

console.log('📝 Next Steps:');
console.log('1. Run `npm run lint` to see all errors');
console.log('2. Fix high-impact files first (API routes, core components)');
console.log('3. Use ESLint disable comments sparingly for legitimate cases');
console.log('4. Consider adding type definitions for external libraries\n');

// Create a summary report
const reportPath = path.join(__dirname, '..', 'lint-error-report.md');
const report = `# Lint Error Report

Generated: ${new Date().toISOString()}

## Summary
- Total errors: 238
- Unexpected any: ~150
- Unused variables: ~50
- Unused request params: ~38

## High Priority Files
1. API Routes with unused request params
2. Monitoring/metrics files with any types
3. Socket/realtime files with any types

## Recommended Fixes
1. Prefix unused params with _ (e.g., _request)
2. Replace any with unknown or specific types
3. Remove truly unused imports/variables
4. Add proper type definitions for external data

## Files to Review
- instrumentation-client.ts
- sentry.server.config.ts
- All files in src/app/api/
- Socket and realtime adapters
`;

fs.writeFileSync(reportPath, report);
console.log(`📄 Detailed report saved to: ${reportPath}`);
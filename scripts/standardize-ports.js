#!/usr/bin/env node

/**
 * Script to find and report all port references in the codebase
 * Helps identify inconsistencies between 3001 and 3003
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Searching for port references in the codebase...\n');

// Search for port 3001
console.log('📍 Files using port 3001:');
try {
  const result3001 = execSync(`grep -r "3001" --include="*.{js,ts,tsx,json,md}" . 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20`, { encoding: 'utf-8' });
  console.log(result3001);
} catch (e) {
  console.log('  No references to port 3001 found or grep failed');
}

// Search for port 3003
console.log('\n📍 Files using port 3003:');
try {
  const result3003 = execSync(`grep -r "3003" --include="*.{js,ts,tsx,json,md}" . 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20`, { encoding: 'utf-8' });
  console.log(result3003);
} catch (e) {
  console.log('  No references to port 3003 found');
}

// Check package.json scripts
console.log('\n📦 Package.json scripts:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
Object.entries(packageJson.scripts).forEach(([name, script]) => {
  if (script.includes('PORT') || script.includes('3001') || script.includes('3003')) {
    console.log(`  ${name}: ${script}`);
  }
});

// Check environment files
console.log('\n🔐 Environment file references:');
['.env.example', '.env.local', '.env'].forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const portLines = content.split('\n').filter(line => 
      line.includes('PORT') || line.includes('3001') || line.includes('3003')
    );
    if (portLines.length > 0) {
      console.log(`\n  ${file}:`);
      portLines.forEach(line => console.log(`    ${line}`));
    }
  }
});

console.log('\n💡 Recommendations:');
console.log('1. Standardize on PORT=3001 in all files');
console.log('2. Use process.env.PORT || 3001 for defaults');
console.log('3. Update all hardcoded port references to use environment variables');
console.log('4. Ensure consistency across all configuration files\n');
#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * 
 * This script helps analyze the Next.js bundle size and identify
 * opportunities for optimization.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing bundle size...\n');

// Check if @next/bundle-analyzer is installed
try {
  require.resolve('@next/bundle-analyzer');
} catch (e) {
  console.log('📦 Installing @next/bundle-analyzer...');
  execSync('npm install --save-dev @next/bundle-analyzer', { stdio: 'inherit' });
}

// Create a temporary next.config for analysis
const analyzeConfig = `
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: true,
  openAnalyzer: true,
});

const baseConfig = require('./next.config.cjs');

module.exports = withBundleAnalyzer(baseConfig);
`;

const tempConfigPath = path.join(process.cwd(), 'next.config.analyze.js');

try {
  // Write temporary config
  fs.writeFileSync(tempConfigPath, analyzeConfig);
  
  console.log('🛠️  Building with bundle analyzer...');
  console.log('This will open your browser with the bundle analysis.\n');
  
  // Run build with analyzer
  execSync('ANALYZE=true next build --config next.config.analyze.js', { 
    stdio: 'inherit',
    env: { ...process.env, ANALYZE: 'true' }
  });
  
} catch (error) {
  console.error('❌ Error during bundle analysis:', error.message);
} finally {
  // Clean up temporary config
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
}

console.log('\n✅ Bundle analysis complete!');
console.log('\n📊 Tips for optimization:');
console.log('1. Look for large dependencies that could be replaced with smaller alternatives');
console.log('2. Check for duplicate modules across chunks');
console.log('3. Identify components that could benefit from code splitting');
console.log('4. Consider lazy loading heavy dependencies');
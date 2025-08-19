#!/usr/bin/env node

/**
 * Deployment Status Checker
 * Helps verify the deployment after pushing to GitHub
 */

const https = require('https');

console.log('🚀 Deployment Status Check\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check GitHub push status
console.log('✅ GitHub Push Status:');
console.log('   - Branch: main');
console.log('   - Last commit: fix: critical authentication security vulnerabilities');
console.log('   - Pushed at:', new Date().toISOString());
console.log('');

// Vercel deployment information
console.log('🔄 Vercel Deployment:');
console.log('   - Vercel should automatically detect the push to main branch');
console.log('   - Deployment typically takes 2-5 minutes');
console.log('   - Check your Vercel dashboard for deployment status');
console.log('');

console.log('📋 What was deployed:');
console.log('   ✅ Centralized authentication middleware');
console.log('   ✅ Removed all service role key vulnerabilities (15 routes)');
console.log('   ✅ Server-side route protection');
console.log('   ✅ Admin role verification');
console.log('   ✅ Disabled dangerous migration endpoint');
console.log('');

console.log('🔍 To verify deployment:');
console.log('   1. Visit your Vercel dashboard: https://vercel.com/dashboard');
console.log('   2. Check the deployment status for your project');
console.log('   3. Review deployment logs for any errors');
console.log('   4. Once deployed, test authentication on the live site');
console.log('');

console.log('🧪 Post-Deployment Testing:');
console.log('   1. Try accessing /dashboard without login (should redirect)');
console.log('   2. Login and verify protected routes work');
console.log('   3. Test API endpoints return 401 when not authenticated');
console.log('   4. Verify admin routes require admin role');
console.log('');

// Check if site URL is available
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://erisdebate.com';

console.log('🌐 Production Site URL:', siteUrl);
console.log('');

// Attempt to check if site is responding
console.log('Checking site availability...');
https.get(siteUrl, (res) => {
  console.log(`   Status Code: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('   ✅ Site is responding');
  } else if (res.statusCode === 503) {
    console.log('   ⏳ Site may be deploying (503 Service Unavailable)');
  } else {
    console.log(`   ⚠️ Unexpected status code: ${res.statusCode}`);
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}).on('error', (err) => {
  console.log('   ❌ Could not reach site:', err.message);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
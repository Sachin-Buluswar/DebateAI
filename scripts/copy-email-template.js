#!/usr/bin/env node

/**
 * Helper script to copy email templates to clipboard
 * Usage: npm run copy-email [template-name]
 * Example: npm run copy-email confirm-signup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const templateDir = path.join(__dirname, '..', 'src', 'email-templates');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n📧 Available Email Templates:\n');
  console.log('  • confirm-signup   - Email verification for new signups');
  console.log('  • reset-password   - Password reset requests');
  console.log('  • magic-link       - Passwordless login links');
  console.log('  • change-email     - Email address change confirmation');
  console.log('  • welcome          - Welcome email after signup\n');
  console.log('Usage: npm run copy-email [template-name]');
  console.log('Example: npm run copy-email confirm-signup\n');
  process.exit(0);
}

const templateName = args[0];
const templateFile = path.join(templateDir, `${templateName}.html`);

if (!fs.existsSync(templateFile)) {
  console.error(`❌ Template "${templateName}" not found!`);
  console.log('\nAvailable templates: confirm-signup, reset-password, magic-link, change-email, welcome\n');
  process.exit(1);
}

try {
  const content = fs.readFileSync(templateFile, 'utf8');
  
  // Detect OS and use appropriate clipboard command
  const platform = process.platform;
  
  if (platform === 'darwin') {
    // macOS
    execSync('pbcopy', { input: content });
  } else if (platform === 'linux') {
    // Linux
    try {
      execSync('xclip -selection clipboard', { input: content });
    } catch (e) {
      // Fallback to xsel if xclip is not available
      execSync('xsel --clipboard --input', { input: content });
    }
  } else if (platform === 'win32') {
    // Windows
    execSync('clip', { input: content });
  } else {
    throw new Error('Unsupported platform');
  }
  
  console.log(`\n✅ Template "${templateName}" copied to clipboard!`);
  console.log('\n📋 Next steps:');
  console.log('1. Go to Supabase Dashboard → Authentication → Email Templates');
  console.log(`2. Select "${templateName.replace('-', ' ')}" template`);
  console.log('3. Enable "Custom email"');
  console.log('4. Paste the template (Cmd/Ctrl + V)');
  console.log('5. Save changes\n');
  
} catch (error) {
  console.error('❌ Failed to copy to clipboard:', error.message);
  console.log('\nYou can manually copy the template from:');
  console.log(templateFile);
  process.exit(1);
}
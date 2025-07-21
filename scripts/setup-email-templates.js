#!/usr/bin/env node

/**
 * Interactive guide for setting up email templates in Supabase
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const templates = [
  { name: 'confirm-signup', description: 'Email verification for new signups' },
  { name: 'reset-password', description: 'Password reset requests' },
  { name: 'magic-link', description: 'Passwordless login links' },
  { name: 'change-email', description: 'Email address change confirmation' }
];

console.log('\n🎨 Eris Debate Email Template Setup Assistant\n');
console.log('This guide will help you configure custom email templates in Supabase.\n');

let currentStep = 0;

function showStep() {
  if (currentStep >= templates.length) {
    console.log('\n✅ All templates configured!\n');
    console.log('📝 Final steps:\n');
    console.log('1. Go to Supabase Dashboard → Authentication → Email Settings');
    console.log('2. Set Sender email (e.g., noreply@yourdomain.com)');
    console.log('3. Set Sender name to "Eris Debate"');
    console.log('4. Consider configuring custom SMTP for better deliverability\n');
    console.log('🎉 Your email templates are now beautifully branded!\n');
    rl.close();
    return;
  }

  const template = templates[currentStep];
  console.log(`\n📧 Step ${currentStep + 1}/${templates.length}: ${template.description}`);
  console.log('─'.repeat(60));
  
  rl.question('\nPress Enter to copy the template to clipboard...', () => {
    try {
      // Copy template to clipboard
      execSync(`npm run copy-email ${template.name}`, { stdio: 'inherit' });
      
      console.log('\n📋 Template copied! Now:\n');
      console.log('1. Go to Supabase Dashboard → Authentication → Email Templates');
      console.log(`2. Select "${template.name.replace('-', ' ')}" template`);
      console.log('3. Toggle "Enable custom email" to ON');
      console.log('4. Paste the template (Cmd/Ctrl + V)');
      console.log('5. Save changes\n');
      
      rl.question('Press Enter when done to continue to next template...', () => {
        currentStep++;
        showStep();
      });
    } catch (error) {
      console.error('\n❌ Error copying template:', error.message);
      rl.question('Press Enter to retry...', () => {
        showStep();
      });
    }
  });
}

console.log('Prerequisites:');
console.log('- Your Supabase Dashboard should be open');
console.log('- You should be logged in to your project\n');

rl.question('Ready to start? (y/n) ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    showStep();
  } else {
    console.log('\nSetup cancelled. Run this script again when ready.\n');
    rl.close();
  }
});
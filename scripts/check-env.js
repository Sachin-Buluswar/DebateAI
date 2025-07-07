#!/usr/bin/env node

/**
 * Check if all required environment variables are set
 * Run with: node scripts/check-env.js
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
  { name: 'OPENAI_API_KEY', description: 'OpenAI API key for GPT-4o' },
];

const OPTIONAL_VARS = [
  { name: 'ELEVENLABS_API_KEY', description: 'ElevenLabs API key for TTS/STT' },
  { name: 'NEXT_PUBLIC_SITE_URL', description: 'Site URL for production' },
  { name: 'PORT', description: 'Server port (default: 3000)' },
];

console.log('\n🔍 Checking environment variables...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found!');
  console.log('   Create it by copying .env.local.example:');
  console.log('   cp .env.local.example .env.local\n');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

let hasErrors = false;

console.log('Required Variables:');
console.log('==================\n');

for (const varInfo of REQUIRED_VARS) {
  const value = process.env[varInfo.name];
  if (!value) {
    console.log(`❌ ${varInfo.name} - MISSING`);
    console.log(`   ${varInfo.description}`);
    hasErrors = true;
  } else if (value.includes('your_') || value.includes('placeholder')) {
    console.log(`⚠️  ${varInfo.name} - PLACEHOLDER VALUE`);
    console.log(`   ${varInfo.description}`);
    console.log(`   Current: ${value.substring(0, 20)}...`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varInfo.name} - SET`);
    console.log(`   ${value.substring(0, 20)}...`);
  }
  console.log('');
}

console.log('\nOptional Variables:');
console.log('===================\n');

for (const varInfo of OPTIONAL_VARS) {
  const value = process.env[varInfo.name];
  if (!value) {
    console.log(`ℹ️  ${varInfo.name} - Not set`);
    console.log(`   ${varInfo.description}`);
  } else {
    console.log(`✅ ${varInfo.name} - SET`);
    console.log(`   ${value}`);
  }
  console.log('');
}

// Check Supabase connection
console.log('\nChecking Supabase connection...');
if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  supabase
    .from('health_check')
    .select('*')
    .limit(1)
    .then(({ error }) => {
      if (error) {
        console.log('⚠️  Supabase connection test failed:', error.message);
        console.log('   Make sure your database is set up correctly\n');
      } else {
        console.log('✅ Supabase connection successful!\n');
      }
      
      // Summary
      if (hasErrors) {
        console.log('\n❌ Environment setup incomplete!');
        console.log('   Please set all required variables in .env.local\n');
        process.exit(1);
      } else {
        console.log('\n✅ All required environment variables are set!\n');
        console.log('Optional features:');
        if (!process.env.ELEVENLABS_API_KEY) {
          console.log('- Voice features disabled (no ElevenLabs API key)');
        }
        console.log('\nYou can start the development server with: npm run dev\n');
      }
    });
} else {
  if (hasErrors) {
    console.log('\n❌ Environment setup incomplete!');
    console.log('   Please set all required variables in .env.local\n');
    process.exit(1);
  }
} 
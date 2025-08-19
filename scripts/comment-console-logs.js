#!/usr/bin/env node

/**
 * Script to comment out console statements for production
 * Preserves the statements for future debugging but prevents execution
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRECTORIES = ['src'];

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Files to skip entirely
const SKIP_FILES = [
  'instrumentation.ts',
  'sentry.server.config.ts', 
  'sentry.client.config.ts',
  '.test.',
  '.spec.',
  'monitoring',
  'logger'
];

// Critical files that need special attention
const CRITICAL_FILES = [
  'SocketManager.ts',
  'DebateManager.ts',
  'elevenLabsWebSocket.ts',
  'debate/page.tsx'
];

// Counters
let filesProcessed = 0;
let statementsCommented = 0;
let filesModified = 0;
let criticalFilesFixed = 0;

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(skipFile => filePath.includes(skipFile));
}

function isCriticalFile(filePath) {
  return CRITICAL_FILES.some(criticalFile => filePath.includes(criticalFile));
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return;
  }

  const isCritical = isCriticalFile(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Count console statements before
  const consoleBefore = (content.match(/console\.(log|error|warn|info|debug|trace)/g) || []).length;
  
  // Pattern to match console statements at the beginning of lines (with any indentation)
  // This regex handles multi-line console statements better
  const consolePattern = /^(\s*)(console\.(log|error|warn|info|debug|trace)\([^;]*\);?)/gm;
  
  // Replace console statements with commented versions
  content = content.replace(consolePattern, (match, indent, statement) => {
    // Skip if already commented
    if (content.substring(content.lastIndexOf('\n', content.indexOf(match)), content.indexOf(match)).includes('//')) {
      return match;
    }
    
    statementsCommented++;
    
    // For critical files, add more context
    if (isCritical) {
      return `${indent}// PRODUCTION: Console disabled - Critical file\n${indent}// ${statement}`;
    }
    
    return `${indent}// PRODUCTION: Console disabled\n${indent}// ${statement}`;
  });
  
  // Also handle console statements that might be part of larger expressions
  // But be careful not to break code logic
  const inlinePattern = /([^/][^/]\s*)(console\.(log|error|warn|info|debug|trace)\([^)]*\))/g;
  content = content.replace(inlinePattern, (match, prefix, statement) => {
    // Only comment if it's safe (not part of a conditional or assignment)
    if (!prefix.includes('=') && !prefix.includes('?') && !prefix.includes(':')) {
      statementsCommented++;
      return `${prefix}/* ${statement} */`;
    }
    return match;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    
    if (isCritical) {
      criticalFilesFixed++;
      console.log(`   ✅ Fixed critical file: ${path.basename(filePath)}`);
    }
    
    // Count console statements after
    const consoleAfter = (content.match(/^[^/]*console\.(log|error|warn|info|debug|trace)/gm) || []).length;
    
    if (consoleAfter > 0) {
      console.log(`   ⚠️  ${path.basename(filePath)}: ${consoleBefore - consoleAfter} fixed, ${consoleAfter} remaining`);
    }
  }
  
  filesProcessed++;
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .git, .next
      if (item !== 'node_modules' && item !== '.git' && item !== '.next' && item !== 'build') {
        processDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(fullPath);
      if (EXTENSIONS.includes(ext)) {
        processFile(fullPath);
      }
    }
  }
}

console.log('🧹 Commenting out console statements for production...\n');

// Process all directories
for (const dir of DIRECTORIES) {
  if (fs.existsSync(dir)) {
    console.log(`📁 Processing ${dir}...`);
    processDirectory(dir);
  }
}

console.log('\n✅ Console cleanup complete!');
console.log(`📊 Statistics:`);
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Console statements commented: ${statementsCommented}`);
console.log(`   Critical files fixed: ${criticalFilesFixed}`);

if (statementsCommented > 0) {
  console.log('\n💡 Console statements have been commented out.');
  console.log('   They are preserved for debugging but won\'t execute.');
  console.log('\n📝 To restore for development, uncomment them or use git to revert.');
}

// Check if there are any remaining active console statements
const checkRemaining = require('child_process').execSync(
  'grep -r "^[^/]*console\\." src --include="*.ts" --include="*.tsx" | wc -l',
  { encoding: 'utf8' }
).trim();

if (parseInt(checkRemaining) > 0) {
  console.log(`\n⚠️  Warning: ${checkRemaining} console statements may still be active.`);
  console.log('   Run "npm run lint" to identify them.');
}
#!/usr/bin/env node

/**
 * Script to clean console statements for production
 * This script wraps console statements in NODE_ENV checks
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRECTORIES = ['src'];

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Patterns to skip (already commented or wrapped)
const SKIP_PATTERNS = [
  /\/\/.*console\./,  // Already commented
  /if\s*\([^)]*NODE_ENV[^)]*\)\s*{?\s*console\./,  // Already wrapped in NODE_ENV check
  /process\.env\.NODE_ENV\s*!==?\s*['"]production['"]\s*&&\s*console\./  // Already has production check
];

// Files to skip entirely
const SKIP_FILES = [
  'instrumentation.ts',
  'sentry.server.config.ts',
  'sentry.client.config.ts',
  'clean-console-logs.js',
  'pre-deploy-fixes.sh'
];

// Counters
let filesProcessed = 0;
let statementsWrapped = 0;
let filesModified = 0;

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(skipFile => filePath.includes(skipFile));
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Split into lines for processing
  const lines = content.split('\n');
  const processedLines = [];
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line contains a console statement
    if (line.match(/console\.(log|error|warn|info|debug|trace)/)) {
      // Check if we should skip this line
      const shouldSkip = SKIP_PATTERNS.some(pattern => pattern.test(line));
      
      if (!shouldSkip) {
        // Get indentation
        const indent = line.match(/^(\s*)/)[1];
        
        // Check if it's a multi-line console statement
        let fullStatement = line;
        let endLineIndex = i;
        
        // Count open parentheses to handle multi-line statements
        let openParens = (line.match(/\(/g) || []).length;
        let closeParens = (line.match(/\)/g) || []).length;
        
        while (openParens > closeParens && endLineIndex < lines.length - 1) {
          endLineIndex++;
          fullStatement += '\n' + lines[endLineIndex];
          openParens += (lines[endLineIndex].match(/\(/g) || []).length;
          closeParens += (lines[endLineIndex].match(/\)/g) || []).length;
        }
        
        // Wrap in production check
        if (process.env.NODE_ENV === 'production') {
          // In production build, comment out
          const commentedLines = fullStatement.split('\n').map((l, idx) => {
            if (idx === 0) {
              return `${indent}// PRODUCTION: Console disabled\n${indent}// ${l.trim()}`;
            }
            return `${indent}// ${l.trim()}`;
          });
          processedLines.push(commentedLines.join('\n'));
        } else {
          // For development, wrap in NODE_ENV check
          processedLines.push(`${indent}if (process.env.NODE_ENV !== 'production') {`);
          const wrappedLines = fullStatement.split('\n').map(l => `${indent}  ${l.trim()}`);
          processedLines.push(...wrappedLines);
          processedLines.push(`${indent}}`);
        }
        
        // Skip the lines we've already processed
        i = endLineIndex;
        modified = true;
        statementsWrapped++;
      } else {
        processedLines.push(line);
      }
    } else {
      processedLines.push(line);
    }
  }
  
  if (modified) {
    const newContent = processedLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    filesModified++;
  }
  
  filesProcessed++;
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (item !== 'node_modules' && item !== '.git' && item !== '.next') {
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

console.log('🧹 Cleaning console statements for production...\n');

// Process all directories
for (const dir of DIRECTORIES) {
  if (fs.existsSync(dir)) {
    console.log(`Processing ${dir}...`);
    processDirectory(dir);
  }
}

console.log('\n✅ Console cleanup complete!');
console.log(`📊 Statistics:`);
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Console statements wrapped: ${statementsWrapped}`);

if (statementsWrapped > 0) {
  console.log('\n💡 Console statements have been wrapped in NODE_ENV checks.');
  console.log('   They will not execute in production builds.');
}
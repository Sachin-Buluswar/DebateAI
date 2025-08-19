#!/usr/bin/env node

/**
 * Script to fix common lint errors
 * Focuses on unused variables and any types
 */

const fs = require('fs');
const path = require('path');

// Files with critical errors to fix
const filesToFix = [
  'src/app/(authenticated)/dashboard/page.tsx',
  'src/app/(authenticated)/debate/page.tsx',
  'src/app/(authenticated)/history/page.tsx',
  'src/app/(authenticated)/layout.tsx',
  'src/app/(authenticated)/speech-feedback/[id]/page.tsx',
  'src/app/(authenticated)/search/page.tsx',
  'src/app/(authenticated)/learn/[category]/[slug]/page.tsx',
  'src/app/(authenticated)/debate/[id]/page.tsx',
];

// Counters
let filesFixed = 0;
let errorsFixed = 0;

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Fix unused error variables in catch blocks
  // Pattern: } catch (error) { -> } catch (_error) {
  content = content.replace(/\} catch \((error|err|e)\) \{/g, (match, varName) => {
    // Check if the variable is actually used
    const catchBlockMatch = content.match(new RegExp(`} catch \\(${varName}\\) \\{[^}]*}`));
    if (catchBlockMatch) {
      const catchBlock = catchBlockMatch[0];
      // Check if variable is referenced (not in console statements)
      if (!catchBlock.includes(`${varName}`) || catchBlock.includes(`// console.`)) {
        errorsFixed++;
        return `} catch (_${varName}) {`;
      }
    }
    return match;
  });
  
  // Fix unused parameters in callbacks
  // Common patterns: .then(error => -> .then(_error =>
  content = content.replace(/\.catch\(([a-zA-Z]+)\s*=>/g, (match, varName) => {
    // Check if the variable is used in the arrow function
    const functionBody = content.substring(content.indexOf(match));
    const endIndex = functionBody.search(/\n|\;/);
    const body = functionBody.substring(0, endIndex);
    
    if (!body.includes(varName) || body.includes('// console.')) {
      errorsFixed++;
      return `.catch(_${varName} =>`;
    }
    return match;
  });
  
  // Fix window.onerror unused parameters
  if (content.includes('window.onerror')) {
    content = content.replace(
      /window\.onerror = function \(message, source, lineno, colno, error\)/g,
      'window.onerror = function (_message, _source, _lineno, _colno, _error)'
    );
    errorsFixed++;
  }
  
  // Fix specific known unused variables
  const unusedPatterns = [
    { pattern: /catch \(debateError\)/g, replacement: 'catch (_debateError)' },
    { pattern: /catch \(speechError\)/g, replacement: 'catch (_speechError)' },
    { pattern: /catch \(urlParseError\)/g, replacement: 'catch (_urlParseError)' },
    { pattern: /\(attemptNumber\)/g, replacement: '(_attemptNumber)' },
  ];
  
  unusedPatterns.forEach(({ pattern, replacement }) => {
    if (content.match(pattern)) {
      content = content.replace(pattern, replacement);
      errorsFixed++;
    }
  });
  
  // Fix TextAreaField import if unused
  if (content.includes("import { TextAreaField }") && !content.includes("<TextAreaField")) {
    content = content.replace(
      "import { TextAreaField } from '@/components/ui/FormField';",
      "// Unused import removed by lint fix\n// import { TextAreaField } from '@/components/ui/FormField';"
    );
    errorsFixed++;
  }
  
  // Fix formErrors if unused
  if (content.includes("const [formErrors, setFormErrors]") && !content.includes("formErrors.")) {
    // Comment out the unused state
    content = content.replace(
      /const \[formErrors, setFormErrors\] = useState.*?\);/g,
      '// Unused state - commented by lint fix\n  // $&'
    );
    errorsFixed++;
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    filesFixed++;
    console.log(`✅ Fixed ${filePath}`);
  }
}

console.log('🔧 Fixing common lint errors...\n');

filesToFix.forEach(file => {
  fixFile(file);
});

// Also fix the instrumentation files
['instrumentation-client.ts', 'sentry.server.config.ts'].forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Fix Sentry any types - these are acceptable for error handling
    content = content.replace(/catch \(e\)/g, 'catch (_e)');
    content = content.replace(/\(error, hint\)/g, '(error, _hint)');
    
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      filesFixed++;
      errorsFixed += 2;
      console.log(`✅ Fixed ${file}`);
    }
  }
});

console.log(`\n✅ Lint fixes complete!`);
console.log(`📊 Statistics:`);
console.log(`   Files fixed: ${filesFixed}`);
console.log(`   Errors fixed: ${errorsFixed}`);

console.log('\n💡 Remaining any types are mostly in error handling and external APIs.');
console.log('   These can be left as-is for production.');
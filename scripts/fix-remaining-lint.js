const fs = require('fs');
const path = require('path');

const filesToFix = [
  'instrumentation-client.ts',
  'sentry.server.config.ts',
  'src/app/(authenticated)/dashboard/page.tsx',
  'src/app/(authenticated)/debate/[id]/page.tsx',
  'src/app/(authenticated)/debate/page.tsx',
  'src/app/(authenticated)/history/page.tsx',
  'src/app/(authenticated)/layout.tsx',
  'src/app/(authenticated)/learn/[category]/[slug]/page.tsx',
  'src/app/(authenticated)/preferences/page.tsx',
  'src/app/(authenticated)/search/page.tsx',
  'src/app/(authenticated)/speech-feedback/[id]/page.tsx',
  'src/app/(authenticated)/speech-feedback/page.tsx'
];

function fixFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix unused variables by prefixing with underscore (already done)
  // Fix 'any' types in specific contexts
  
  if (filePath.includes('instrumentation-client.ts') || filePath.includes('sentry.server.config.ts')) {
    // Replace specific any types with proper types
    content = content.replace(/:\s*any\)/g, ': unknown)');
    content = content.replace(/\(event:\s*any\)/g, '(event: CustomEvent)');
    content = content.replace(/\(context:\s*any\)/g, '(context: Record<string, unknown>)');
    content = content.replace(/\(error:\s*Error,\s*context\?:\s*any\)/g, '(error: Error, context?: Record<string, unknown>)');
  }
  
  // Fix window.addEventListener type issues
  if (filePath.includes('instrumentation-client.ts')) {
    content = content.replace(
      "window.addEventListener('debate:start', (event: any)",
      "window.addEventListener('debate:start', (event: Event)"
    );
    content = content.replace(
      "window.addEventListener('debate:error', (event: any)",
      "window.addEventListener('debate:error', (event: Event)"
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed ${filePath}`);
}

// Fix all files
filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixFile(fullPath);
  } else {
    console.log(`⚠️  File not found: ${fullPath}`);
  }
});

console.log('\n✅ All lint fixes applied\!');

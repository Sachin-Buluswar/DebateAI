const fs = require('fs');
const path = require('path');

// Files with console statements that need to be commented out
const filesToClean = [
  'src/app/api/sql/route.ts',
  'src/lib/envValidation.ts', 
  'src/backend/modules/wikiSearch/indexingService.ts',
  'src/app/ui-demo/page.tsx',
  'src/instrumentation.ts'
];

// Files that should keep console statements (monitoring/logging infrastructure)
const excludeFiles = [
  'src/lib/monitoring/index.ts',
  'src/lib/monitoring/logger.ts',
  'src/components/monitoring/ErrorBoundary.tsx'
];

function commentOutConsole(filePath) {
  if (excludeFiles.some(exclude => filePath.includes(exclude))) {
    console.log(`Skipping ${filePath} (monitoring/logging file)`);
    return;
  }

  console.log(`Cleaning ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip if already commented
    if (trimmed.startsWith('//')) continue;
    
    // Check if line contains console statement
    if (line.match(/console\.(log|error|warn|info|debug)\(/)) {
      // Comment out the line
      lines[i] = line.replace(/^(\s*)/, '$1// PRODUCTION: Console disabled\n$1// ');
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Commented out console statements in ${filePath}`);
  } else {
    console.log(`No uncommented console statements found in ${filePath}`);
  }
}

// Clean all specified files
filesToClean.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  commentOutConsole(fullPath);
});

console.log('\nConsole cleanup complete!');

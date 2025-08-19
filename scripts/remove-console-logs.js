const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}');

let totalRemoved = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const originalLength = content.length;
    
    // Comment out console statements (preserve for debugging)
    content = content.replace(
        /^(\s*)(console\.(log|error|warn|info|debug))/gm,
        '$1// PRODUCTION: Console disabled\n$1// $2'
    );
    
    if (content.length !== originalLength) {
        fs.writeFileSync(file, content);
        totalRemoved++;
    }
});

console.log(`Commented out console statements in ${totalRemoved} files`);

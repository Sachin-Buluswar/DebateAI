#!/bin/bash

# Pre-deployment fixes script
# Run this before deploying to production

echo "🚀 Starting pre-deployment fixes..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check for debug endpoints
echo -e "${YELLOW}Checking for debug endpoints...${NC}"
if [ -f "src/app/api/debug/route.ts" ]; then
    echo -e "${RED}⚠️  Debug endpoint found! Add ENABLE_DEBUG_ENDPOINT=false to .env.production${NC}"
fi

if [ -f "src/app/api/sql/route.ts" ]; then
    echo -e "${RED}⚠️  SQL endpoint found! Add ENABLE_SQL_ENDPOINT=false to .env.production${NC}"
fi

# 2. Count console statements
echo -e "${YELLOW}Counting console statements...${NC}"
CONSOLE_COUNT=$(grep -r "console\.\(log\|error\|warn\|info\|debug\)" src/ --include="*.ts" --include="*.tsx" | wc -l)
echo -e "Found ${RED}$CONSOLE_COUNT${NC} console statements"

# 3. Check for fallback API keys
echo -e "${YELLOW}Checking for fallback API keys...${NC}"
if grep -q "'fallback'" src/shared/env.ts 2>/dev/null; then
    echo -e "${RED}⚠️  Fallback API keys found in src/shared/env.ts!${NC}"
fi

# 4. Create .env.production.example if it doesn't exist
echo -e "${YELLOW}Creating .env.production.example...${NC}"
cat > .env.production.example << 'EOF'
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# APIs
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
OPENAI_VECTOR_STORE_ID=your_vector_store_id

# Security - CRITICAL FOR PRODUCTION
ENABLE_DEBUG_ENDPOINT=false
ENABLE_SQL_ENDPOINT=false
DEBUG_API_KEY=
ADMIN_SQL_KEY=

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
ALLOWED_ORIGINS=https://your-production-domain.com

# Optional
ELEVENLABS_STT_MODEL_ID=
ELEVENLABS_CROSSFIRE_AGENT_ID=
EOF
echo -e "${GREEN}✅ Created .env.production.example${NC}"

# 5. Run TypeScript check
echo -e "${YELLOW}Running TypeScript check...${NC}"
npm run typecheck 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
else
    echo -e "${RED}❌ TypeScript errors found. Run 'npm run typecheck' to see details${NC}"
fi

# 6. Run lint check
echo -e "${YELLOW}Running ESLint...${NC}"
LINT_ERRORS=$(npm run lint 2>&1 | grep -o "[0-9]* problems" | cut -d' ' -f1)
if [ -z "$LINT_ERRORS" ] || [ "$LINT_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ No lint errors${NC}"
else
    echo -e "${RED}❌ Found $LINT_ERRORS lint errors. Run 'npm run lint' to see details${NC}"
fi

# 7. Check for TODO/FIXME comments
echo -e "${YELLOW}Checking for TODO/FIXME comments...${NC}"
TODO_COUNT=$(grep -r "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Found $TODO_COUNT TODO/FIXME comments${NC}"
fi

# 8. Check bundle size
echo -e "${YELLOW}Checking build...${NC}"
BUILD_OUTPUT=$(npm run build 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
    
    # Extract bundle size
    BUNDLE_SIZE=$(echo "$BUILD_OUTPUT" | grep -A 2 "First Load JS" | tail -1 | grep -o "[0-9.]* kB" | head -1)
    if [ ! -z "$BUNDLE_SIZE" ]; then
        echo -e "Bundle size: ${YELLOW}$BUNDLE_SIZE${NC}"
    fi
else
    echo -e "${RED}❌ Build failed. Run 'npm run build' to see errors${NC}"
fi

# 9. Create console cleanup script
echo -e "${YELLOW}Creating console cleanup script...${NC}"
cat > scripts/remove-console-logs.js << 'EOF'
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
EOF
echo -e "${GREEN}✅ Created scripts/remove-console-logs.js${NC}"

# Summary
echo ""
echo "========================================="
echo -e "${YELLOW}PRE-DEPLOYMENT SUMMARY${NC}"
echo "========================================="

ISSUES=0

if [ -f "src/app/api/debug/route.ts" ] || [ -f "src/app/api/sql/route.ts" ]; then
    echo -e "${RED}❌ CRITICAL: Debug/SQL endpoints need to be disabled${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$CONSOLE_COUNT" -gt 50 ]; then
    echo -e "${RED}❌ HIGH: $CONSOLE_COUNT console statements need cleanup${NC}"
    echo "   Run: node scripts/remove-console-logs.js"
    ISSUES=$((ISSUES + 1))
fi

if grep -q "'fallback'" src/shared/env.ts 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: Remove fallback API keys from src/shared/env.ts${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -z "$LINT_ERRORS" ] && [ "$LINT_ERRORS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  MEDIUM: $LINT_ERRORS lint errors to fix${NC}"
    echo "   Run: npm run lint -- --fix"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for deployment.${NC}"
else
    echo ""
    echo -e "${RED}❌ Found $ISSUES issue(s) that need attention before deployment.${NC}"
    echo ""
    echo "Quick fixes:"
    echo "1. Set environment variables in .env.production (see .env.production.example)"
    echo "2. Run: node scripts/remove-console-logs.js"
    echo "3. Run: npm run lint -- --fix"
    echo "4. Run: npm run build"
fi

echo ""
echo "========================================="
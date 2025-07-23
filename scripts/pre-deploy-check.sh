#!/bin/bash

# Pre-deployment check script for Eris Debate
# Run this before deploying to ensure everything is ready

echo "🚀 Eris Debate Pre-Deployment Check"
echo "==================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0
WARNINGS=0

# Function to check command success
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function for warnings
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo "1️⃣ Checking Node.js and npm versions..."
node --version
npm --version
echo ""

echo "2️⃣ Checking environment variables..."
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
    
    # Check for critical env vars
    CRITICAL_VARS=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "OPENAI_API_KEY"
        "ELEVENLABS_API_KEY"
    )
    
    for var in "${CRITICAL_VARS[@]}"; do
        if grep -q "^$var=" .env.local; then
            echo -e "${GREEN}✓${NC} $var is set"
        else
            echo -e "${RED}✗${NC} $var is missing"
            ERRORS=$((ERRORS + 1))
        fi
    done
    
    # Check for recommended env vars
    if ! grep -q "^ELEVENLABS_CROSSFIRE_AGENT_ID=" .env.local; then
        warning "ELEVENLABS_CROSSFIRE_AGENT_ID is missing (debates won't work fully)"
    fi
    
    if ! grep -q "^OPENAI_VECTOR_STORE_ID=" .env.local; then
        warning "OPENAI_VECTOR_STORE_ID is missing (vector search won't work)"
    fi
else
    echo -e "${RED}✗${NC} .env.local not found!"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "3️⃣ Running TypeScript compilation check..."
npm run typecheck > /dev/null 2>&1
check_status $? "TypeScript compilation"
echo ""

echo "4️⃣ Running ESLint..."
LINT_ERRORS=$(npm run lint 2>&1 | grep -c "error" || true)
if [ "$LINT_ERRORS" -gt 0 ]; then
    warning "Found $LINT_ERRORS ESLint errors (non-blocking)"
else
    echo -e "${GREEN}✓${NC} No ESLint errors"
fi
echo ""

echo "5️⃣ Checking for build issues..."
echo "Running build (this may take a minute)..."
npm run build > build.log 2>&1
BUILD_STATUS=$?
if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build successful"
    rm build.log
else
    echo -e "${RED}✗${NC} Build failed! Check build.log for details"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo "6️⃣ Security checks..."
# Check for hardcoded secrets
if grep -r "sk-[a-zA-Z0-9]" --include="*.{js,ts,tsx}" src/ 2>/dev/null | grep -v ".example"; then
    echo -e "${RED}✗${NC} Found potential hardcoded API keys!"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} No hardcoded secrets found"
fi

# Check CORS configuration
if grep -q '"*"' vercel.json 2>/dev/null; then
    warning "CORS is set to wildcard (*) in vercel.json - fix before production"
else
    echo -e "${GREEN}✓${NC} CORS configuration looks secure"
fi

# Check SQL endpoint
if [ -f .env.local ] && grep -q "^ENABLE_SQL_ENDPOINT=true" .env.local; then
    echo -e "${RED}✗${NC} SQL endpoint is enabled - disable for production!"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} SQL endpoint is disabled"
fi
echo ""

echo "7️⃣ Checking dependencies..."
npm audit --production > /dev/null 2>&1
AUDIT_STATUS=$?
if [ $AUDIT_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No security vulnerabilities in dependencies"
else
    VULN_COUNT=$(npm audit --production 2>/dev/null | grep -E "(high|critical)" | wc -l || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
        warning "Found $VULN_COUNT high/critical vulnerabilities - run 'npm audit'"
    fi
fi
echo ""

echo "8️⃣ File system checks..."
# Check for temp/test files
if [ -d "src/temp-debatetest2-refactor" ]; then
    warning "Temporary refactor directory exists - consider removing"
fi

# Check for console.log statements
CONSOLE_COUNT=$(grep -r "console.log" --include="*.{ts,tsx}" src/ 2>/dev/null | wc -l || echo "0")
if [ "$CONSOLE_COUNT" -gt 100 ]; then
    warning "Found $CONSOLE_COUNT console.log statements - consider proper logging"
fi
echo ""

echo "==============================================="
echo "📊 Summary:"
echo "==============================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warnings found (non-blocking)${NC}"
    fi
    
    echo ""
    echo "🎉 Project is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Review and fix any warnings above"
    echo "2. Test all features locally"
    echo "3. Deploy with: vercel --prod"
else
    echo -e "${RED}❌ $ERRORS critical errors found!${NC}"
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found${NC}"
    echo ""
    echo "⛔ Fix the errors above before deploying!"
fi
echo ""

exit $ERRORS
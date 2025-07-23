#!/bin/bash

echo "🔧 Fixing lint errors properly..."

# Fix src/app/api/socket-init/route.ts
echo "Fixing src/app/api/socket-init/route.ts"
sed -i '' 's/GET((_request:/GET(_request:/g' src/app/api/socket-init/route.ts
sed -i '' 's/POST((_request:/POST(_request:/g' src/app/api/socket-init/route.ts
sed -i '' 's/_request: NextRequest))/_request: NextRequest)/g' src/app/api/socket-init/route.ts

# Fix src/app/api/monitoring/health/route.ts  
echo "Fixing src/app/api/monitoring/health/route.ts"
sed -i '' 's/export async function GET(request:/export async function GET(_request:/g' src/app/api/monitoring/health/route.ts
sed -i '' 's/NextRequest)))/NextRequest)/g' src/app/api/monitoring/health/route.ts

# Fix src/app/api/monitoring/metrics/route.ts
echo "Fixing src/app/api/monitoring/metrics/route.ts"
sed -i '' 's/export async function GET(request:/export async function GET(_request:/g' src/app/api/monitoring/metrics/route.ts
sed -i '' 's/NextRequest)))/NextRequest)/g' src/app/api/monitoring/metrics/route.ts

# Fix src/middleware.ts
echo "Fixing src/middleware.ts"
sed -i '' 's/export function middleware(request:/export function middleware(_request:/g' src/middleware.ts

# Fix common unused variables in catch blocks
echo "Fixing unused error variables in catch blocks..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/catch (e)/catch (_e)/g'

# Fix some any types with unknown
echo "Fixing some any types..."
# In error handlers
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(error: any)/(error: unknown)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(e: any)/(e: unknown)/g'

echo "✅ Applied automatic fixes"
echo ""
echo "📊 Remaining manual fixes needed:"
echo "1. Replace 'any[]' with 'unknown[]' or specific types"
echo "2. Replace 'Record<string, any>' with 'Record<string, unknown>'"
echo "3. Review and type any remaining 'any' types"
echo "4. Remove truly unused imports"
echo ""
echo "Run 'npm run lint' to see remaining errors"
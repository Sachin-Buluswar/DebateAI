#!/bin/bash

# Script to fix unused request parameters in Next.js API routes
# This is a common pattern where request is required but not used

echo "🔧 Fixing unused request parameters in API routes..."

# Files with unused request parameters based on lint output
files=(
  "src/app/api/socket-init/route.ts"
  "src/app/api/socketio/route.ts"
  "src/app/api/monitoring/health/route.ts"
  "src/app/api/monitoring/metrics/route.ts"
  "src/middleware.ts"
)

# Fix each file
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing: $file"
    # Replace (request: NextRequest) with (_request: NextRequest)
    sed -i '' 's/\(request: NextRequest\)/\(_request: NextRequest\)/g' "$file"
    # Also handle cases where request is the only parameter
    sed -i '' 's/export async function \(GET\|POST\|PUT\|DELETE\|PATCH\)(request:/export async function \1(_request:/g' "$file"
  fi
done

echo "✅ Fixed request parameter naming in API routes"
echo ""
echo "📝 Note: You may need to manually review and fix:"
echo "   - Cases where 'request' is used in the function body"
echo "   - Other unused variables that need the underscore prefix"
echo "   - Or remove them entirely if truly not needed"
echo ""
echo "Run 'npm run lint' to see remaining errors"
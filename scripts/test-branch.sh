#!/bin/bash

# Simple script to help test different versions

echo "🔍 Current branch: $(git branch --show-current)"
echo ""
echo "📋 Available branches:"
git branch
echo ""
echo "🌐 To test this version:"
echo "   npm run dev"
echo "   Then visit: http://localhost:3001"
echo ""
echo "🔄 To switch branches:"
echo "   git checkout main          (your live version)"
echo "   git checkout [branch-name] (test version)"
echo ""
echo "✅ To approve changes (merge to main):"
echo "   git checkout main"
echo "   git merge [branch-name]"
echo "   git push origin main"
echo ""
echo "❌ To reject changes (delete test branch):"
echo "   git checkout main"
echo "   git branch -D [branch-name]"
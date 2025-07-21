#!/bin/bash

# Eris Debate Comprehensive Feature Testing Script
# This script tests all major features to verify integration

echo "🧪 Eris Debate Feature Testing Script"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (update if needed)
BASE_URL="http://localhost:3001"

# Test counter
PASSED=0
FAILED=0

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $response)"
        ((FAILED++))
    fi
}

echo -e "\n${YELLOW}1. Testing Health & Status Endpoints${NC}"
echo "-----------------------------------"
test_endpoint "GET" "/api/health" "" "200" "Health endpoint"

echo -e "\n${YELLOW}2. Testing Authentication Flow${NC}"
echo "----------------------------"
echo "⚠️  Note: Auth endpoints require valid Supabase setup"
test_endpoint "GET" "/auth" "" "200" "Auth page"
test_endpoint "GET" "/auth/callback" "" "307" "Auth callback (expect redirect without params)"

echo -e "\n${YELLOW}3. Testing Wiki Search Endpoints${NC}"
echo "------------------------------"
test_endpoint "POST" "/api/wiki-search" '{"query":"test"}' "401" "Wiki search (expect 401 without auth)"
test_endpoint "POST" "/api/wiki-rag-search" '{"query":"test"}' "200" "RAG search"
test_endpoint "POST" "/api/wiki-generate" '{"query":"test"}' "401" "Wiki generate (expect 401 without auth)"

echo -e "\n${YELLOW}4. Testing Speech Feedback Endpoints${NC}"
echo "----------------------------------"
test_endpoint "GET" "/speech-feedback" "" "200" "Speech feedback page"
test_endpoint "POST" "/api/speech-feedback/init" '{"filename":"test.mp3"}' "400" "Speech init (expect 400 without all params)"

echo -e "\n${YELLOW}5. Testing Debate Endpoints${NC}"
echo "-------------------------"
test_endpoint "GET" "/debate" "" "200" "Debate page"
test_endpoint "POST" "/api/debate/analyze" '{"transcript":"test"}' "400" "Debate analysis (expect 400 without all params)"

echo -e "\n${YELLOW}6. Testing User Preference Endpoints${NC}"
echo "----------------------------------"
test_endpoint "GET" "/api/user_preferences" "" "401" "User preferences (expect 401 without auth)"

echo -e "\n${YELLOW}7. Testing Static Pages${NC}"
echo "---------------------"
test_endpoint "GET" "/" "" "200" "Home page"
test_endpoint "GET" "/dashboard" "" "200" "Dashboard page"
test_endpoint "GET" "/search" "" "200" "Search page"
test_endpoint "GET" "/history" "" "200" "History page"

echo -e "\n${YELLOW}Summary${NC}"
echo "-------"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
else
    echo -e "\n${RED}❌ Some tests failed. Please check the errors above.${NC}"
fi

echo -e "\n${YELLOW}Additional Manual Testing Required:${NC}"
echo "- Upload and process a speech file"
echo "- Start a debate session with AI"
echo "- Perform a wiki search with authentication"
echo "- Test real-time debate features"
echo "- Verify audio recording/playback"
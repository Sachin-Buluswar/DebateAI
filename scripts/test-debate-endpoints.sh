#!/bin/bash

# Atlas Debate - Debate Endpoints Test Script
# Tests debate-related API endpoints

echo "🧪 Atlas Debate Debate Endpoints Test"
echo "================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
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

# Function to test Socket.IO connection
test_socketio() {
    echo -n "Testing Socket.IO initialization... "
    
    # First fetch to initialize
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/socketio")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: 200, Got: $response)"
        ((FAILED++))
    fi
}

echo -e "\n${YELLOW}1. Testing Debate API Endpoints${NC}"
echo "------------------------------"

# Test Socket.IO endpoint
test_socketio

# Test debate analysis endpoint
test_endpoint "POST" "/api/debate/analyze" \
    '{"transcript":"Test debate transcript","userParticipantId":"human-pro-1"}' \
    "200" \
    "Debate analysis with valid data"

test_endpoint "POST" "/api/debate/analyze" \
    '{"transcript":""}' \
    "400" \
    "Debate analysis with empty transcript"

# Test debate session endpoints (if they exist)
test_endpoint "GET" "/api/debate/sessions" "" "401" "List debate sessions (expect auth required)"
test_endpoint "POST" "/api/debate/save" '{"topic":"Test"}' "401" "Save debate (expect auth required)"

echo -e "\n${YELLOW}2. Testing Real-time Debate Features${NC}"
echo "-----------------------------------"

# Test WebSocket upgrade
echo -n "Testing WebSocket upgrade capability... "
ws_response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    "$BASE_URL/api/socketio/?EIO=4&transport=websocket")

if [ "$ws_response" = "400" ] || [ "$ws_response" = "426" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (WebSocket endpoint exists)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Unexpected response: $ws_response)"
    ((FAILED++))
fi

echo -e "\n${YELLOW}3. Testing AI Integration Endpoints${NC}"
echo "---------------------------------"

# Check if speech generation endpoint exists
test_endpoint "POST" "/api/debate/generate-speech" \
    '{"topic":"AI regulation","speaker":"Emily Carter","phase":"CONSTRUCTIVE"}' \
    "401" \
    "AI speech generation (expect auth required)"

# Check TTS endpoint
test_endpoint "POST" "/api/tts" \
    '{"text":"Hello world","voice":"Emily"}' \
    "401" \
    "Text-to-speech (expect auth required)"

echo -e "\n${YELLOW}Summary${NC}"
echo "-------"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All debate endpoint tests passed!${NC}"
else
    echo -e "\n${RED}❌ Some tests failed. Check the errors above.${NC}"
fi

echo -e "\n${YELLOW}Integration Testing Notes:${NC}"
echo "- Full debate flow requires authenticated WebSocket connection"
echo "- Audio streaming requires valid ElevenLabs API key"
echo "- AI speech generation requires OpenAI API key"
echo "- Use the web interface for full integration testing"
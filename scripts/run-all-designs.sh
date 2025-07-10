#!/bin/bash

echo "🎨 Starting all 5 DebateAI UI designs..."
echo ""
echo "This will start each design on a different port:"
echo "  - Modern Competitive: http://localhost:3001"
echo "  - Academic Professional: http://localhost:3002"
echo "  - Gamified Learning: http://localhost:3003"
echo "  - Minimalist Focus: http://localhost:3004"
echo "  - Bold Dynamic: http://localhost:3005"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Function to kill all child processes on exit
cleanup() {
    echo ""
    echo "Stopping all servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up trap to call cleanup on Ctrl+C
trap cleanup INT

# Start each design in background using next dev directly
echo "Starting Modern Competitive on port 3001..."
(cd designs/competitive && npx next dev -p 3001) &

echo "Starting Academic Professional on port 3002..."
(cd designs/academic && npx next dev -p 3002) &

echo "Starting Gamified Learning on port 3003..."
(cd designs/gamified && npx next dev -p 3003) &

echo "Starting Minimalist Focus on port 3004..."
(cd designs/minimalist && npx next dev -p 3004) &

echo "Starting Bold Dynamic on port 3005..."
(cd designs/dynamic && npx next dev -p 3005) &

echo ""
echo "✅ All servers starting up. Please wait a moment for them to be ready."
echo ""

# Wait for all background jobs
wait
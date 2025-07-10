#!/bin/bash

# Check if design name was provided
if [ -z "$1" ]; then
    echo "Usage: ./scripts/run-design.sh <design-name>"
    echo ""
    echo "Available designs:"
    echo "  - competitive (Modern Competitive)"
    echo "  - academic (Academic Professional)"
    echo "  - gamified (Gamified Learning)"
    echo "  - minimalist (Minimalist Focus)"
    echo "  - dynamic (Bold Dynamic)"
    echo ""
    echo "Example: ./scripts/run-design.sh competitive"
    exit 1
fi

DESIGN=$1
PORT=3001

# Map design names to descriptions
case $DESIGN in
    competitive)
        DESC="Modern Competitive"
        ;;
    academic)
        DESC="Academic Professional"
        PORT=3002
        ;;
    gamified)
        DESC="Gamified Learning"
        PORT=3003
        ;;
    minimalist)
        DESC="Minimalist Focus"
        PORT=3004
        ;;
    dynamic)
        DESC="Bold Dynamic"
        PORT=3005
        ;;
    *)
        echo "Error: Unknown design '$DESIGN'"
        echo "Run this script without arguments to see available designs."
        exit 1
        ;;
esac

# Check if design directory exists
if [ ! -d "designs/$DESIGN" ]; then
    echo "Error: Design directory 'designs/$DESIGN' not found"
    exit 1
fi

echo "🎨 Starting $DESC design..."
echo "   URL: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd designs/$DESIGN && npx next dev -p $PORT
#!/bin/bash

# Docker run script for DebateAI
# Usage: ./scripts/docker-run.sh [environment]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to development environment
ENVIRONMENT=${1:-development}

echo -e "${GREEN}Starting DebateAI in ${ENVIRONMENT} mode...${NC}"

# Check if .env file exists
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local file not found${NC}"
    echo "Please create .env.local with required environment variables"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Stop any existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down 2>/dev/null || true

# Start containers based on environment
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${BLUE}Starting production environment...${NC}"
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}Production environment started!${NC}"
    echo -e "${YELLOW}Services:${NC}"
    echo "  - Application: http://localhost (via nginx)"
    echo "  - Direct app: http://localhost:3000 (internal only)"
    echo ""
    echo -e "${YELLOW}View logs:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml logs -f"
else
    echo -e "${BLUE}Starting development environment...${NC}"
    docker-compose up -d
    
    echo -e "${GREEN}Development environment started!${NC}"
    echo -e "${YELLOW}Services:${NC}"
    echo "  - Application: http://localhost:3000"
    echo ""
    echo -e "${YELLOW}View logs:${NC}"
    echo "  docker-compose logs -f"
fi

# Wait for health check
echo -e "${YELLOW}Waiting for application to be ready...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if [ "$ENVIRONMENT" == "production" ]; then
        if curl -s http://localhost/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}Application is ready!${NC}"
            break
        fi
    else
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}Application is ready!${NC}"
            break
        fi
    fi
    
    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${RED}Application failed to start within 60 seconds${NC}"
    echo "Check logs for errors:"
    if [ "$ENVIRONMENT" == "production" ]; then
        docker-compose -f docker-compose.prod.yml logs --tail=50
    else
        docker-compose logs --tail=50
    fi
    exit 1
fi

echo -e "\n${GREEN}DebateAI is running successfully!${NC}"
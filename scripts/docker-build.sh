#!/bin/bash

# Docker build script for Atlas Debate
# Usage: ./scripts/docker-build.sh [environment]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to development environment
ENVIRONMENT=${1:-development}

# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1

echo -e "${GREEN}Building Atlas Debate Docker image for ${ENVIRONMENT}...${NC}"

# Check if .env file exists
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local file not found${NC}"
    echo "Please create .env.local with required environment variables"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: Required environment variable $var is not set${NC}"
        exit 1
    fi
done

# Build the Docker image
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}Building production image...${NC}"
    docker build \
        --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
        --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.atlasdebate.com}" \
        --target runner \
        -t atlas-debate:production \
        -t atlas-debate:latest \
        -f Dockerfile \
        .
else
    echo -e "${YELLOW}Building development image...${NC}"
    docker build \
        --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
        --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}" \
        -t atlas-debate:development \
        -f Dockerfile \
        .
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker image built successfully!${NC}"
    docker images | grep atlas-debate
else
    echo -e "${RED}Docker build failed!${NC}"
    exit 1
fi
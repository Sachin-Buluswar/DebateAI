#!/bin/bash

# Script to check if port 3001 is in use and offer to kill the process

PORT=3001
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Checking if port $PORT is in use...${NC}"

# Find processes using port 3001
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  PROCESSES=$(lsof -i :$PORT)
  if [ -n "$PROCESSES" ]; then
    echo -e "${RED}Port $PORT is currently in use by:${NC}"
    echo "$PROCESSES"
    
    # Extract the PID(s)
    PIDS=$(echo "$PROCESSES" | grep -v "PID" | awk '{print $2}' | sort -u)
    
    echo -e "${YELLOW}Would you like to kill these processes? (y/n)${NC}"
    read -r answer
    
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      for PID in $PIDS; do
        echo -e "${YELLOW}Killing process $PID...${NC}"
        kill -9 "$PID"
      done
      echo -e "${GREEN}All processes using port $PORT have been terminated.${NC}"
    else
      echo -e "${YELLOW}Aborted. Processes remain running.${NC}"
    fi
  else
    echo -e "${GREEN}Port $PORT is available.${NC}"
  fi
else
  # Linux and other UNIX-like systems
  PROCESSES=$(netstat -tulpn 2>/dev/null | grep ":$PORT ")
  if [ -n "$PROCESSES" ]; then
    echo -e "${RED}Port $PORT is currently in use by:${NC}"
    echo "$PROCESSES"
    
    # Extract the PID(s)
    PIDS=$(echo "$PROCESSES" | grep -o 'LISTEN[ ]*[0-9]*/' | grep -o '[0-9]*')
    
    echo -e "${YELLOW}Would you like to kill these processes? (y/n)${NC}"
    read -r answer
    
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      for PID in $PIDS; do
        echo -e "${YELLOW}Killing process $PID...${NC}"
        kill -9 "$PID"
      done
      echo -e "${GREEN}All processes using port $PORT have been terminated.${NC}"
    else
      echo -e "${YELLOW}Aborted. Processes remain running.${NC}"
    fi
  else
    echo -e "${GREEN}Port $PORT is available.${NC}"
  fi
fi

echo -e "${BLUE}Done checking port $PORT.${NC}" 
#!/usr/bin/env python3
import sys
import subprocess

try:
    # Try using textutil on macOS
    result = subprocess.run(['textutil', '-convert', 'txt', '-stdout', '/Users/sachinbuluswar/Desktop/API Reference - OpenAI API.pdf'], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(f"Error: {result.stderr}")
except Exception as e:
    print(f"Failed to extract PDF: {e}")
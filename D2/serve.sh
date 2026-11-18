#!/bin/bash
# Simple local server script

echo "Starting local server..."
echo "Navigate to http://localhost:8080 in your browser"
echo "Press Ctrl+C to stop"

# Try different methods to start a local server
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v node &> /dev/null; then
    npx http-server . -p 8080
else
    echo "No suitable server found. Please install Python or Node.js"
fi
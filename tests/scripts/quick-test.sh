#!/bin/bash

# Quick test commands for MCP server with session management
# Run the server first: npm run mcp:http:dev

echo "Quick MCP Server Tests with Session Management"
echo "=============================================="

# 1. Simple health check
echo -e "\n1. Health check:"
curl http://localhost:3050/health
echo

# 2. Initialize session
echo -e "\n2. Initialize session:"
INIT_RESPONSE=$(curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {},
      "clientInfo": {
        "name": "curl-test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }')

echo "$INIT_RESPONSE" | jq .

# Extract session ID from response headers (this is tricky with curl, so we'll use a different approach)
# For now, let's just show how to use a session ID if you have one

# 3. Example with session ID (you need to get this from the initialize response)
echo -e "\n3. Calculate BMI (needs session ID from step 2):"
echo "Note: You need to extract the session ID from the response headers of the initialize request"
echo "Then use it like this:"
echo
echo 'curl -X POST http://localhost:3050/mcp \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Mcp-Session-Id: YOUR_SESSION_ID_HERE" \'
echo '  -d '"'"'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"calculate_bmi","arguments":{"weight":70,"height":1.75}},"id":2}'"'"

echo -e "\n"
#\!/bin/bash

# Test if server is running and Claude Code tool is available

echo "1. Testing server health..."
curl -s http://localhost:3050/health | jq

echo -e "\n2. Testing root endpoint..."
curl -s http://localhost:3050/ | jq

echo -e "\n3. Testing MCP with sessionless mode..."
# Use the test script format that supports SSE
response=$(curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }' -s --no-buffer | grep "^data: " | head -1 | sed 's/^data: //')

echo "$response" | jq '.result.tools[] | select(.name == "claude_code_query") | {name, description}'

echo -e "\n4. Claude Code tool is:"
if echo "$response" | jq -e '.result.tools[] | select(.name == "claude_code_query")' > /dev/null 2>&1; then
  echo "✅ AVAILABLE"
else
  echo "❌ NOT FOUND"
fi

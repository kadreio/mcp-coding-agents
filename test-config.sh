#!/bin/bash

echo "Testing Claude Code configuration..."
echo

# Test 1: Default configuration
echo "1. Testing with default configuration:"
curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: test-config-1" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq '.result.tools[] | select(.name == "claude_code_query") | .inputSchema.properties.options.properties | keys'

echo
echo "2. Testing with CLAUDE_CODE_ENABLE=false:"
# Start server with tool disabled
CLAUDE_CODE_ENABLE=false npm run mcp:http &
SERVER_PID=$!
sleep 3

curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: test-config-2" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }' | jq '.result.tools[] | select(.name == "claude_code_query")'

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo
echo "3. Testing with custom defaults:"
# Set custom configuration
export CLAUDE_CODE_DEFAULT_CWD=/tmp
export CLAUDE_CODE_DEFAULT_MODEL=claude-3-sonnet
export CLAUDE_CODE_DEFAULT_PERMISSION_MODE=default
export CLAUDE_CODE_MAX_MESSAGES=50

npm run mcp:http &
SERVER_PID=$!
sleep 3

echo "Checking tool descriptions with custom defaults:"
curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: test-config-3" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/list"
  }' | jq '.result.tools[] | select(.name == "claude_code_query") | .inputSchema.properties.options.properties | {
    cwd: .cwd.description,
    model: .model.description,
    permissionMode: .permissionMode.description,
    maxMessages: .maxMessages.description
  }'

kill $SERVER_PID 2>/dev/null

echo
echo "Test complete!"
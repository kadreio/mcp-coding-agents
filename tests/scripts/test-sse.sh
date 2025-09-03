#!/bin/bash

# MCP Server Test with SSE response handling
# Run the server first: npm run mcp:http:dev

echo "MCP Server Test with SSE Response Handling"
echo "=========================================="

# 1. Health check (returns JSON)
echo -e "\n1. Health check:"
curl -s http://localhost:3050/health | jq .

# 2. Initialize session and extract from SSE response
echo -e "\n2. Initializing session..."
TEMP_FILE=$(mktemp)

# Make request and save full response including headers
curl -s -i -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
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
  }' > "$TEMP_FILE"

# Extract session ID from headers
SESSION_ID=$(grep -i "mcp-session-id:" "$TEMP_FILE" | cut -d' ' -f2 | tr -d '\r')

echo "Session ID: $SESSION_ID"

# Extract JSON from SSE response (look for data: lines and extract JSON)
echo "Response:"
grep "^data: " "$TEMP_FILE" | sed 's/^data: //' | jq . 2>/dev/null || echo "No JSON data found in SSE response"

# Function to make request and extract JSON from SSE
make_request() {
    local method=$1
    local params=$2
    local id=$3
    
    # Make request and extract JSON from SSE data lines
    curl -s -X POST http://localhost:3050/mcp \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -H "Mcp-Session-Id: $SESSION_ID" \
      -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"$method\",
        \"params\": $params,
        \"id\": $id
      }" | grep "^data: " | sed 's/^data: //' | jq .
}

# 3. Execute command
echo -e "\n3. Execute command (echo test):"
make_request "tools/call" '{"name": "execute_command", "arguments": {"command": "echo SSE test output"}}' 2

# 4. List tools
echo -e "\n4. List available tools:"
make_request "tools/list" '{}' 3

# 5. Read server config
echo -e "\n5. Read server configuration:"
make_request "resources/read" '{"uri": "config://server"}' 4

# Clean up
rm "$TEMP_FILE"

echo -e "\nAll tests completed!"
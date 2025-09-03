#!/bin/bash

# MCP Server Test with automatic session management
# Run the server first: npm run mcp:http:dev

echo "MCP Server Test with Session Management"
echo "======================================="

# 1. Health check
echo -e "\n1. Health check:"
curl -s http://localhost:3050/health | jq .

# 2. Initialize session and capture headers
echo -e "\n2. Initializing session..."
TEMP_FILE=$(mktemp)
# Use only application/json in Accept header to avoid SSE responses
curl -s -i -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
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

# Extract and display the JSON response
echo "Response:"
tail -n 1 "$TEMP_FILE" | jq .

if [ -z "$SESSION_ID" ]; then
    echo "Error: No session ID received"
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    exit 1
fi

echo -e "\nSession ID: $SESSION_ID"

# 3. Execute command using session
echo -e "\n3. Execute command (echo test):"
curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "execute_command",
      "arguments": {"command": "echo Session test output"}
    },
    "id": 2
  }' | jq .

# 4. List available tools
echo -e "\n4. List available tools:"
curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 3
  }' | jq .

# 5. Read server config resource
echo -e "\n5. Read server configuration:"
curl -s -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": {
      "uri": "config://server"
    },
    "id": 4
  }' | jq .

# Clean up
rm "$TEMP_FILE"

echo -e "\nAll tests completed with session ID: $SESSION_ID"
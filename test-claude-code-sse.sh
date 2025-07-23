#!/bin/bash

# Test Claude Code query tool with SSE streaming
echo "Testing Claude Code query tool with SSE streaming..."
echo "This will show real-time notifications as they arrive"
echo

# Use curl with SSE support to see streaming notifications
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: test-sse-$(date +%s)" \
  -N \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "claude_code_query",
      "arguments": {
        "prompt": "Write a simple Python function that adds two numbers",
        "options": {
          "permissionMode": "bypassPermissions",
          "maxMessages": 50
        }
      }
    }
  }'

echo
echo "Test complete!"
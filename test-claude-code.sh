#!/bin/bash

# Test Claude Code query tool
echo "Testing Claude Code query tool..."
echo

# Simple test prompt
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: test-session-$(date +%s)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "claude_code_query",
      "arguments": {
        "prompt": "Create a simple hello world Python script that prints the current time",
        "options": {
          "permissionMode": "bypassPermissions",
          "maxMessages": 10,
          "includeSystemMessages": true
        }
      }
    }
  }' | jq '.'

echo
echo "Test complete!"
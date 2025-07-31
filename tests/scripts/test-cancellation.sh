#!/bin/bash

echo "Testing Claude Code query cancellation..."
echo "This will start a query and cancel it after 2 seconds"
echo

# Start the query in background
echo "Starting long-running query..."
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: test-cancel-$(date +%s)" \
  -N \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "claude_code_query",
      "arguments": {
        "prompt": "Write a detailed implementation of a web server with multiple endpoints, authentication, database integration, and comprehensive error handling. Take your time to think through all the details.",
        "options": {
          "permissionMode": "bypassPermissions",
          "maxTurns": 10
        }
      }
    }
  }' &

# Get the PID
CURL_PID=$!

# Wait 2 seconds
echo "Query running... will cancel in 2 seconds"
sleep 2

# Cancel the request
echo
echo "Sending cancellation signal..."
kill -TERM $CURL_PID 2>/dev/null

# Wait a moment for cleanup
sleep 1

echo
echo "Test complete! Check the server logs for cancellation messages."
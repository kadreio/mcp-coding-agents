#!/bin/bash

# Test SSE timestamps tool to verify SSE is working
echo "Testing SSE timestamps tool..."
echo "You should see events streaming in real-time"
echo

curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: test-timestamps-$(date +%s)" \
  -N \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "stream_sse_timestamps",
      "arguments": {
        "delay": 500
      }
    }
  }'

echo
echo "Test complete!"
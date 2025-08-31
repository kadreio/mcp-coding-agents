#!/bin/bash

# Test script for session persistence with SQLite storage

API_BASE="http://localhost:3050/api/v1"
API_KEY="${CLAUDE_API_KEY:-test-key}"

echo "=== Testing Session Persistence with SQLite ==="
echo

# Start the server
echo "Starting MCP server with HTTP transport..."
npm run mcp:http &
SERVER_PID=$!

# Wait for server to start
sleep 3

# 1. Create a session
echo "1. Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$API_BASE/sessions" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "permissionMode": "bypassPermissions",
    "maxTurns": 5
  }')

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
echo "Created session: $SESSION_ID"
echo

# 2. Send a message (this will create message history)
echo "2. Sending test message..."
curl -s -X POST "$API_BASE/sessions/$SESSION_ID/messages" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello! Please respond with a simple greeting.",
    "stream": false
  }' | jq '.'
echo

# 3. Check message history
echo "3. Checking message history..."
curl -s -X GET "$API_BASE/sessions/$SESSION_ID/messages" \
  -H "x-api-key: $API_KEY" | jq '.pagination'
echo

# 4. Stop server
echo "4. Stopping server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
echo "Server stopped"
echo

# 5. Restart server
echo "5. Restarting server..."
npm run mcp:http &
SERVER_PID=$!
sleep 3
echo

# 6. Check if session persisted
echo "6. Checking if session persisted after restart..."
PERSISTED_SESSION=$(curl -s -X GET "$API_BASE/sessions/$SESSION_ID" \
  -H "x-api-key: $API_KEY")

if echo "$PERSISTED_SESSION" | grep -q "$SESSION_ID"; then
  echo "✅ Session persisted successfully!"
  echo "$PERSISTED_SESSION" | jq '.'
else
  echo "❌ Session not found after restart"
  echo "$PERSISTED_SESSION"
fi
echo

# 7. Check message history after restart
echo "7. Checking message history after restart..."
MESSAGES=$(curl -s -X GET "$API_BASE/sessions/$SESSION_ID/messages" \
  -H "x-api-key: $API_KEY")

if echo "$MESSAGES" | jq -e '.messages | length > 0' > /dev/null; then
  echo "✅ Message history persisted successfully!"
  echo "$MESSAGES" | jq '.pagination'
else
  echo "❌ Message history not found after restart"
fi
echo

# 8. Check database file
echo "8. Checking database file..."
if [ -f "./data/sessions.db" ]; then
  echo "✅ Database file exists at ./data/sessions.db"
  echo "File size: $(du -h ./data/sessions.db | cut -f1)"
else
  echo "❌ Database file not found"
fi

# Clean up
echo
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo
echo "=== Test completed ==="
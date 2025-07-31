# MCP Streamable HTTP Curl Examples

## Quick Test (No Session Required)

```bash
# Health check
curl http://localhost:3050/health
```

## Full Session Flow

### 1. Initialize Session

```bash
# Initialize and save response with headers
# IMPORTANT: Must include Accept header with both application/json and text/event-stream
curl -i -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {},
      "clientInfo": {
        "name": "curl-test",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'
```

Look for the `Mcp-Session-Id` header in the response.

### 2. Use Session for Subsequent Requests

```bash
# Replace YOUR_SESSION_ID with the actual session ID from step 1
SESSION_ID="YOUR_SESSION_ID"

# Calculate BMI
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calculate_bmi",
      "arguments": {"weight": 70, "height": 1.75}
    },
    "id": 2
  }'

# Get timestamp
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_timestamp",
      "arguments": {}
    },
    "id": 3
  }'

# List tools
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 4
  }'
```

## Streaming Tool Example

The server includes a tool that demonstrates streaming notifications:

```bash
# Call the streaming tool (requires active session)
curl -X POST http://localhost:3050/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "stream_sse_timestamps",
      "arguments": {}
    },
    "id": 5
  }'
```

This tool will send 10 timestamp notifications over 10 seconds via the MCP notification system.

To receive these notifications, establish an SSE connection:

```bash
# After initializing a session, connect to receive SSE notifications
curl -N -H "Mcp-Session-Id: $SESSION_ID" \
     -H "Accept: text/event-stream" \
     http://localhost:3050/mcp
```

## Automated Test Script

Use the provided test script for automatic session handling:

```bash
./tests/scripts/test-with-session.sh
```

This script will:
1. Initialize a session
2. Extract the session ID automatically
3. Run all test cases using the session ID
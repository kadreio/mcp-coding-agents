# MCP HTTP Server Integration Guide

## Endpoints

POST /mcp - Main MCP protocol endpoint
GET /mcp - SSE stream endpoint (requires existing session)
GET /health - Health check returning service status
POST /api/v1/* - Claude Code REST API (if enabled)

## Headers

Required:
- Content-Type: application/json
- Accept: text/event-stream (for SSE support) or application/json

Session Management:
- Mcp-Session-Id: UUID for stateful sessions
- Sessions created on initialize request, reused for subsequent calls
- Sessionless mode uses shared transport

## Request Flow

1. Initialize: POST /mcp with method "initialize" creates session
2. Session ID returned in Mcp-Session-Id response header
3. Subsequent requests include Mcp-Session-Id header
4. SSE stream established via GET /mcp with session header

## SSE Streaming

GET /mcp with Accept: text/event-stream
- Requires active session (Mcp-Session-Id header)
- Returns event stream for notifications
- Events formatted as: data: {json}\n\n
- Keep connection open for continuous notifications

## JSON-RPC Protocol

Request: {"jsonrpc": "2.0", "method": string, "params": object, "id": number|string}
Response: {"jsonrpc": "2.0", "result": any, "id": number|string}
Error: {"jsonrpc": "2.0", "error": {"code": number, "message": string}, "id": number|string|null}

## Type References

See OpenAPI spec for:
- CreateSessionRequest
- SessionResponse
- ErrorResponse
- ClaudeCodeQueryArgs
- StreamingChunk

## Tool Invocation

Method: tools/call
Params: {name: string, arguments: object}
Streaming tools send notifications via SSE

## Error Codes

-32603: Internal server error
-32600: Invalid request
-32601: Method not found
-32602: Invalid params

## Session Lifecycle

1. Initialize creates transport with UUID
2. Transport stored in Map by session ID
3. Reused for all session requests
4. Cleanup on transport.onclose()
5. Shared transport for sessionless operations
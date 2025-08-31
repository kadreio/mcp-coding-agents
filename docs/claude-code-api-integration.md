# Claude Code API Integration Guide

## Base URL
http://localhost:3050/api/v1

## Authentication
Header: x-api-key: {API_KEY}
Required for all endpoints except /health

## Execution Flow

1. Create session: POST /sessions
   Request: CreateSessionRequest
   Response: SessionResponse
   Extract: sessionId

2. Send message: POST /sessions/{sessionId}/messages
   Request: SendMessageRequest
   Response: MessageResponse or StreamInfoResponse (if stream=true)

3. For streaming: POST /sessions/{sessionId}/stream
   Request: StreamRequest
   Response: Server-Sent Events stream

4. Retrieve history: GET /sessions/{sessionId}/messages?limit=100&offset=0
   Response: MessageHistoryResponse

5. End session: DELETE /sessions/{sessionId}

## Server-Sent Events (SSE)

Endpoint: POST /sessions/{sessionId}/stream
Headers: Accept: text/event-stream, Content-Type: application/json

Event types:
- event: connected - Initial connection confirmation
- event: message - Claude Code message (data: ClaudeCodeMessage)
- event: complete - Stream completion (data: CompleteEvent)
- event: error - Error occurred (data: ErrorEvent)

Message flow:
1. Client opens SSE connection with POST body containing prompt
2. Server sends "connected" event
3. Server streams "message" events as Claude processes
4. Server sends "complete" event when done
5. Connection closes

## Message Types in Stream

SDKSystemMessage: type=system, contains tools list and configuration
SDKUserMessage: type=user, contains user prompt or tool results
SDKAssistantMessage: type=assistant, contains Claude responses and tool calls
SDKResultMessage: type=result, contains completion status and usage

## Tool Calls

Tool calls appear within assistant messages:
content: [{type: "text", text: "..."}, {type: "tool_use", name: "Read", id: "...", input: {...}}]

Tool results returned as user messages with type=tool_result in content

## Session Persistence

Sessions stored in SQLite at ./data/sessions.db
Messages include source field: "user" (API input) or "sdk" (all other messages)
Sessions expire after sessionTimeout (default 1 hour)
Message history persists across server restarts

## Error Handling

HTTP status codes:
- 400: Invalid request
- 401: Authentication failed
- 404: Session not found
- 408: Request timeout
- 429: Rate limited
- 500: Server error

Error response format: ErrorResponse

## Rate Limiting

Default: 10 requests per minute per API key
Header returned: X-RateLimit-Remaining

## Concurrent Sessions

Default maximum: 100 active sessions
Automatic cleanup of expired sessions every 60 seconds
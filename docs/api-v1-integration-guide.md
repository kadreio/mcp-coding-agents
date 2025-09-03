# API V1 Integration Guide

## Base URL
http://localhost:3050/api/v1

## Authentication
Header: x-api-key

## Session Management

### Create Session
POST /sessions
Body: CreateSessionRequest
Response: SessionResponse (201) | ErrorResponse (429)
Returns: sessionId (UUID)

### Session Lifecycle
1. Create session with configuration
2. Use sessionId for all subsequent requests
3. Sessions expire based on timeout
4. Delete session when done

## Message Flow

### Non-Streaming
POST /sessions/{sessionId}/messages
Body: SendMessageRequest (stream: false)
Response: MessageResponse

### Streaming (SSE)
1. POST /sessions/{sessionId}/messages with stream: true returns StreamInfoResponse
2. POST /sessions/{sessionId}/stream with StreamRequest
3. SSE Events:
   - event: connected - Initial connection
   - event: message - Claude streaming chunks
   - event: complete - Final response with session_id
   - event: error - Error occurred
   - : keepalive - Every 30s

## SSE Integration
Headers:
- Content-Type: application/json
- Accept: text/event-stream

Connection:
- Persistent connection
- Handle keepalive messages
- Parse data: JSON for each event
- Abort via connection close

## Message Storage
- User messages saved on send
- Assistant messages saved during streaming
- Retrieve via GET /sessions/{sessionId}/messages

## Error Handling
ErrorResponse format with codes:
- SESSION_NOT_FOUND (404)
- MAX_SESSIONS_REACHED (429)
- REQUEST_TIMEOUT (408)
- INVALID_REQUEST (400)

## Key Types (see OpenAPI spec)
- CreateSessionRequest
- SendMessageRequest
- StreamRequest
- SessionResponse
- MessageResponse
- StreamEvents
- ErrorResponse

## Session Configuration
- model: Claude model ID
- cwd: Working directory
- permissionMode: default|acceptEdits|bypassPermissions|plan
- maxTurns: Conversation limit
- timeout: Request timeout (ms)
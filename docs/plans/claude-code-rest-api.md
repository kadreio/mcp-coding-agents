---

Created Date: 2025-08-27

# Feature Plan: Claude Code SDK REST API

# Overview

Currently, the Claude Code SDK is integrated as an MCP tool within our transport-agnostic server. While this works well for MCP clients, there's a need to expose Claude Code functionality through a dedicated REST API to enable broader integrations, web applications, and programmatic access without requiring MCP protocol knowledge.

This plan outlines the design and implementation of a RESTful API that exposes the full capabilities of the Claude Code SDK, including session management, streaming responses, and configuration options.

# Outcomes

- Direct REST API access to Claude Code functionality without MCP protocol overhead
- Session-based conversation management with resume capabilities
- Real-time streaming responses via Server-Sent Events (SSE)
- Comprehensive error handling and status codes
- Rate limiting and authentication support
- API documentation with OpenAPI/Swagger specification
- Metrics and monitoring capabilities

# Open Questions

[ ] Should we use the existing HTTP transport or create a dedicated REST server?
[ ] What authentication mechanism should we use (API keys, JWT, OAuth)?
[ ] Should we implement rate limiting per API key or per IP?
[ ] Do we want to support WebSocket in addition to SSE for streaming?
[ ] Should session data be persisted to disk/database or kept in memory only?
[ ] What are the default session timeout values?
[ ] Should we expose all Claude Code configuration options or a subset?
[ ] Do we want to support batch operations (multiple queries in one request)?

# Tasks

## API Design
[ ] Define OpenAPI/Swagger specification for all endpoints
[ ] Design request/response schemas with proper validation
[ ] Define error response format and status codes
[ ] Document rate limiting headers and behavior
[ ] Create API versioning strategy

## Core Endpoints Implementation
[ ] POST /sessions - Create new Claude Code session
[ ] POST /sessions/{id}/messages - Send message to existing session
[ ] GET /sessions/{id} - Get session status and metadata
[ ] GET /sessions - List active sessions (with pagination)
[ ] DELETE /sessions/{id} - End/cleanup a session
[ ] GET /sessions/{id}/messages - Get message history
[ ] GET /sessions/{id}/stream - SSE endpoint for streaming responses

## Configuration & Management
[ ] GET /models - List available Claude models
[ ] GET /config - Get default configuration
[ ] POST /config - Update default configuration
[ ] GET /health - Health check endpoint
[ ] GET /metrics - Prometheus-compatible metrics

## Session Management
[ ] Implement in-memory session storage with TTL
[ ] Add session cleanup background task
[ ] Implement session persistence interface (for future disk/DB storage)
[ ] Add session locking to prevent concurrent modifications
[ ] Implement session quota management

## Streaming Infrastructure
[ ] Implement SSE handler for real-time updates
[ ] Add connection management and cleanup
[ ] Implement reconnection support with Last-Event-ID
[ ] Add heartbeat/keepalive mechanism
[ ] Handle client disconnections gracefully

## Authentication & Security
[ ] Implement API key authentication middleware
[ ] Add rate limiting middleware
[ ] Implement request validation and sanitization
[ ] Add CORS configuration
[ ] Implement audit logging

## Testing
[ ] Unit tests for all endpoint handlers
[ ] Integration tests with mock Claude Code SDK
[ ] Load tests for concurrent sessions
[ ] SSE streaming tests
[ ] Authentication and rate limiting tests
[ ] Error handling and edge case tests

## Documentation & Tooling
[ ] Generate API documentation from OpenAPI spec
[ ] Create example client implementations (JavaScript, Python, curl)
[ ] Add Postman/Insomnia collection
[ ] Create usage guides and best practices
[ ] Document rate limits and quotas

## Monitoring & Operations
[ ] Add structured logging for all operations
[ ] Implement Prometheus metrics (request rate, latency, errors)
[ ] Add health check with dependency status
[ ] Create alerting rules for common issues
[ ] Add distributed tracing support

# Security

## Authentication
- API key-based authentication with secure storage
- Rate limiting per API key to prevent abuse
- Optional IP allowlisting for additional security

## Input Validation
- Strict schema validation for all inputs
- Prompt injection prevention
- File path validation for CWD parameter
- Command execution sandboxing

## Session Security
- Unique, cryptographically secure session IDs
- Session isolation to prevent cross-session access
- Automatic session cleanup on timeout
- Resource usage limits per session

## Data Protection
- No logging of sensitive prompts or responses
- Secure handling of API keys and credentials
- HTTPS-only communication
- Optional response encryption

# API Endpoints Specification

## Sessions

### POST /api/v1/sessions
Create a new Claude Code session.

**Request Body:**
```json
{
  "model": "claude-3-opus-20240229",
  "cwd": "/home/user/project",
  "permissionMode": "default",
  "appendSystemPrompt": "Additional instructions...",
  "maxTurns": 10,
  "metadata": {
    "userId": "user123",
    "projectId": "proj456"
  }
}
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "model": "claude-3-opus-20240229",
  "status": "active",
  "createdAt": "2025-08-27T10:00:00Z",
  "expiresAt": "2025-08-27T11:00:00Z"
}
```

### POST /api/v1/sessions/{id}/messages
Send a message to an existing session.

**Request Body:**
```json
{
  "prompt": "Help me implement a REST API endpoint",
  "stream": true,
  "timeout": 300000
}
```

**Response (non-streaming):**
```json
{
  "messageId": "msg_123",
  "response": "I'll help you implement a REST API endpoint...",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 500,
    "totalTokens": 650
  }
}
```

### GET /api/v1/sessions/{id}/stream
SSE endpoint for streaming responses.

**Response:**
```
event: message
data: {"type": "assistant", "content": "I'll help you..."}

event: message
data: {"type": "tool_use", "tool": "file_editor", "content": "..."}

event: complete
data: {"summary": "Task completed successfully"}
```

# Error Responses

All error responses follow a consistent format:
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session with ID 550e8400 not found",
    "details": {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000"
    }
  },
  "timestamp": "2025-08-27T10:00:00Z",
  "requestId": "req_abc123"
}
```

# Rate Limiting

Rate limits are enforced per API key:
- 10 sessions per hour
- 100 messages per hour
- 1000 streaming events per hour

Headers included in responses:
- `X-RateLimit-Limit`: Maximum allowed requests
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

# Implementation Notes

1. **Session Storage**: Start with in-memory storage using Map with TTL, design interface for future Redis/database backend.

2. **Streaming**: Use existing SSE implementation from HTTP transport, extend with session-specific routing.

3. **Error Handling**: Wrap Claude Code SDK errors with API-specific error types and proper HTTP status codes.

4. **Metrics**: Track session lifecycle, message latency, error rates, and resource usage.

5. **Backwards Compatibility**: Ensure existing MCP functionality remains unchanged.
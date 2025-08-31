# Claude Code REST API Examples

This document provides examples of how to use the Claude Code REST API with various programming languages.

## API Endpoints

- `POST /api/v1/sessions` - Create a new Claude Code session
- `GET /api/v1/sessions` - List active sessions
- `GET /api/v1/sessions/:id` - Get session details
- `DELETE /api/v1/sessions/:id` - End a session
- `POST /api/v1/sessions/:id/messages` - Send a message to a session
- `GET /api/v1/sessions/:id/messages` - Get message history for a session
- `POST /api/v1/sessions/:id/stream` - SSE endpoint for streaming responses
- `GET /api/v1/models` - List available models
- `GET /api/v1/health` - Health check

## Authentication

All requests (except health check) require an API key in the `x-api-key` header.

## Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');
const EventSource = require('eventsource');

const API_BASE = 'http://localhost:3050/api/v1';
const API_KEY = process.env.CLAUDE_API_KEY;

async function claudeCodeExample() {
  // 1. Create a session
  const sessionResponse = await axios.post(`${API_BASE}/sessions`, {
    model: 'claude-3-opus-20240229',
    permissionMode: 'default',
    maxTurns: 10
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  const sessionId = sessionResponse.data.sessionId;
  console.log('Session created:', sessionId);

  // 2. Send a non-streaming message
  const messageResponse = await axios.post(`${API_BASE}/sessions/${sessionId}/messages`, {
    prompt: 'Hello! What can you help me with?',
    stream: false
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  console.log('Response:', messageResponse.data.response);

  // 3. Stream a response
  // First, create a helper to stream with POST
  const streamResponse = await fetch(`${API_BASE}/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      prompt: 'Write a Python hello world program',
      timeout: 60000
    })
  });

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        console.log('Event:', line.substring(7));
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        console.log('Data:', data);
      }
    }
  }

}
```

### Python

```python
import requests
import json
import sseclient
import os

API_BASE = 'http://localhost:3050/api/v1'
API_KEY = os.environ.get('CLAUDE_API_KEY')

def claude_code_example():
    headers = {'x-api-key': API_KEY}
    
    # 1. Create a session
    session_response = requests.post(f'{API_BASE}/sessions', 
        headers=headers,
        json={
            'model': 'claude-3-opus-20240229',
            'permissionMode': 'default',
            'maxTurns': 10
        })
    
    session_id = session_response.json()['sessionId']
    print(f'Session created: {session_id}')
    
    # 2. Send a non-streaming message
    message_response = requests.post(f'{API_BASE}/sessions/{session_id}/messages',
        headers=headers,
        json={
            'prompt': 'Hello! What can you help me with?',
            'stream': False
        })
    
    print(f'Response: {message_response.json()["response"]}')
    
    # 3. Stream a response
    # Connect to SSE stream with POST
    response = requests.post(f'{API_BASE}/sessions/{session_id}/stream',
        headers={
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json',
            **headers
        },
        json={
            'prompt': 'Write a Python hello world program',
            'timeout': 60000
        },
        stream=True)
    
    client = sseclient.SSEClient(response)
    
    for event in client.events():
        if event.event == 'message':
            data = json.loads(event.data)
            print(f'Stream message: {data}')
        elif event.event == 'complete':
            data = json.loads(event.data)
            print(f'Stream complete: {data}')
            break
    
    # 4. End session
    requests.delete(f'{API_BASE}/sessions/{session_id}', headers=headers)
    print('Session ended')
```

### cURL

```bash
# Set variables
API_KEY="your-api-key"
BASE_URL="http://localhost:3050/api/v1"

# 1. Create a session
SESSION_ID=$(curl -s -X POST "$BASE_URL/sessions" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "model": "claude-3-opus-20240229",
    "permissionMode": "default"
  }' | jq -r '.sessionId')

echo "Session ID: $SESSION_ID"

# 2. Send a non-streaming message
curl -X POST "$BASE_URL/sessions/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "Hello! What can you help me with?",
    "stream": false
  }' | jq

# 3. Connect to SSE stream with POST
curl -N -X POST "$BASE_URL/sessions/$SESSION_ID/stream" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "Write a Python hello world program",
    "timeout": 60000
  }'

# 4. End session
curl -X DELETE "$BASE_URL/sessions/$SESSION_ID" -H "x-api-key: $API_KEY"
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "bufio"
    "strings"
)

const API_BASE = "http://localhost:3050/api/v1"

type SessionRequest struct {
    Model          string `json:"model"`
    PermissionMode string `json:"permissionMode"`
    MaxTurns       int    `json:"maxTurns"`
}

type SessionResponse struct {
    SessionID string `json:"sessionId"`
}

type MessageRequest struct {
    Prompt string `json:"prompt"`
    Stream bool   `json:"stream"`
}

type MessageResponse struct {
    Response string `json:"response"`
}

type StreamResponse struct {
    StreamURL string `json:"streamUrl"`
}

func main() {
    apiKey := os.Getenv("CLAUDE_API_KEY")
    
    // 1. Create session
    sessionReq := SessionRequest{
        Model:          "claude-3-opus-20240229",
        PermissionMode: "default",
        MaxTurns:       10,
    }
    
    sessionData, _ := json.Marshal(sessionReq)
    req, _ := http.NewRequest("POST", API_BASE+"/sessions", bytes.NewBuffer(sessionData))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", apiKey)
    
    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    
    var sessionResp SessionResponse
    json.NewDecoder(resp.Body).Decode(&sessionResp)
    fmt.Printf("Session created: %s\n", sessionResp.SessionID)
    
    // 2. Send message
    messageReq := MessageRequest{
        Prompt: "Hello! What can you help me with?",
        Stream: false,
    }
    
    messageData, _ := json.Marshal(messageReq)
    req, _ = http.NewRequest("POST", API_BASE+"/sessions/"+sessionResp.SessionID+"/messages", 
        bytes.NewBuffer(messageData))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", apiKey)
    
    resp, _ = client.Do(req)
    defer resp.Body.Close()
    
    var messageResp MessageResponse
    json.NewDecoder(resp.Body).Decode(&messageResp)
    fmt.Printf("Response: %s\n", messageResp.Response)
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  },
  "timestamp": "2025-08-27T10:00:00Z",
  "requestId": "unique-request-id"
}
```

Common error codes:
- `SESSION_NOT_FOUND` - Session ID doesn't exist
- `INVALID_REQUEST` - Missing or invalid parameters
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `MISSING_API_KEY` - Authentication required
- `INVALID_API_KEY` - Invalid authentication

## Rate Limiting

Rate limits are enforced per API key:
- 10 sessions per hour
- 100 messages per hour
- 1000 streaming events per hour

Response headers include:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp when limit resets
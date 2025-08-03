# @kadreio/mcp-claude-code

A transport-agnostic MCP (Model Context Protocol) server with Claude Code, Gemini, and Codex agent integrations. Supports both STDIO and HTTP transports for flexible AI model context management.

## Features

- 🚀 **Transport-agnostic architecture** - Clean separation between business logic and transport layers
- 🔄 **Multiple transport modes** - STDIO for direct process communication, HTTP with SSE for network access
- 🤖 **Multiple AI agents** - Claude Code, Gemini, and Codex integrations
- 📦 **Built-in tools** - BMI calculator, timestamp generator, command execution, and more
- 🔧 **Extensible design** - Easy to add new tools, prompts, and transports
- 💬 **Real-time streaming** - Support for notifications and SSE in HTTP mode

## Installation

```bash
npm install -g @kadreio/mcp-claude-code
```

## Quick Start

### Using npx (no installation required)

```bash
# Default mode (HTTP on port 3050)
npx @kadreio/mcp-claude-code

# STDIO mode for direct process communication
npx @kadreio/mcp-claude-code stdio

# HTTP mode with custom port
npx @kadreio/mcp-claude-code http --port 3051

# With specific host binding
npx @kadreio/mcp-claude-code http --host 0.0.0.0
```

### After global installation

```bash
# Default HTTP mode
mcp-claude-code

# STDIO mode
mcp-claude-code stdio

# HTTP mode with options
mcp-claude-code http --port 3051 --no-cors
```

## Transport Modes

### STDIO Mode
Best for editor integrations and direct process communication:
```bash
mcp-claude-code stdio
```
- Communicates via stdin/stdout using JSON-RPC
- No network overhead
- Ideal for local development tools

### HTTP Mode
Best for network access and web integrations:
```bash
mcp-claude-code http --port 3050
```
- RESTful API with SSE support for streaming
- Session management for stateful interactions
- CORS support (configurable)
- Health check endpoint at `/health`

## Available Tools

### Core Tools
- `calculate_bmi` - Calculate Body Mass Index
- `get_timestamp` - Get current timestamp
- `execute_command` - Execute shell commands with timeout support
- `stream_sse_timestamps` - Generate streaming timestamps (HTTP mode)

### AI Agent Tools
- `claude_code_query` - Query Claude Code with streaming responses
- `gemini_query` - Execute Gemini CLI commands
- `codex_query` - Execute Codex with JSONL streaming

## Environment Variables

```bash
# Core Configuration
MCP_PORT=3050                    # HTTP server port (default: 3050)

# Claude Code Configuration
ANTHROPIC_API_KEY=sk-ant-...     # Required for Claude Code
CLAUDE_CODE_ENABLE=true          # Enable/disable Claude Code tool
CLAUDE_CODE_DEFAULT_CWD=/path    # Default working directory
CLAUDE_CODE_DEFAULT_MODEL=...    # Default Claude model
CLAUDE_CODE_MAX_MESSAGES=100     # Max messages to return

# Agent Configuration
GEMINI_API_KEY=...               # For Gemini agent
OPENAI_API_KEY=...               # For Codex agent
```

## Development

```bash
# Clone the repository
git clone https://github.com/kadreio/mcp-claude-code.git
cd mcp-claude-code

# Install dependencies
npm install

# Build the project
npm run build

# Development mode with hot reload
npm run mcp:dev          # Default HTTP mode
npm run mcp:stdio:dev    # STDIO mode
npm run mcp:http:dev     # Explicit HTTP mode

# Run tests
npm test
npm run test:coverage
```

## Architecture

The server uses a clean, transport-agnostic architecture:

```
CoreMCPServer (Business Logic)
       ↓
Transport Interface
    ↙     ↘
STDIO    HTTP
Transport Transport
```

- **CoreMCPServer**: Contains all business logic, tool handlers, and agent integrations
- **Transport Layer**: Thin adapters for different communication protocols
- **Unified CLI**: Single entry point with transport selection

## API Endpoints (HTTP Mode)

- `POST /mcp` - Main MCP endpoint for JSON-RPC requests
- `GET /mcp` - SSE endpoint for streaming notifications
- `GET /health` - Health check endpoint
- `GET /` - Server information and capabilities

## MCP Client Configuration

### For STDIO mode
```json
{
  "mcpServers": {
    "claude-code": {
      "command": "npx",
      "args": ["@kadreio/mcp-claude-code", "stdio"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key"
      }
    }
  }
}
```

### For HTTP mode
```json
{
  "mcpServers": {
    "claude-code": {
      "url": "http://localhost:3050/mcp",
      "transport": "http"
    }
  }
}
```

## Contributing

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture details.

## License

MIT
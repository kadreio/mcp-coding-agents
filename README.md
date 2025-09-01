# @kadreio/mcp-coding-agents

[![CI](https://github.com/kadreio/mcp-coding-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/kadreio/mcp-coding-agents/actions/workflows/ci.yml)
[![Release](https://github.com/kadreio/mcp-coding-agents/actions/workflows/release.yml/badge.svg)](https://github.com/kadreio/mcp-coding-agents/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/@kadreio%2Fmcp-coding-agents.svg)](https://www.npmjs.com/package/@kadreio/mcp-coding-agents)

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
npm install -g @kadreio/mcp-coding-agents
```

### Native Dependencies

This package uses `better-sqlite3` for session persistence, which requires compilation of native code. On most systems, prebuilt binaries are available and installation is automatic. If you encounter issues:

**macOS/Linux**: Ensure you have build tools installed:
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# RHEL/CentOS
sudo yum groupinstall "Development Tools"
```

**Windows**: Install windows-build-tools:
```bash
npm install --global windows-build-tools
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
PORT=3050                        # HTTP server port (default: 3050)

# Claude Code Configuration
ANTHROPIC_API_KEY=sk-ant-...     # Required for Claude Code
CLAUDE_CODE_ENABLE=true          # Enable/disable Claude Code tool
CLAUDE_CODE_DEFAULT_CWD=/path    # Default working directory
CLAUDE_CODE_DEFAULT_MODEL=...    # Default Claude model
CLAUDE_CODE_MAX_MESSAGES=100     # Max messages to return
CLAUDE_CODE_EXECUTABLE_PATH=/path/to/claude  # Path to Claude executable (auto-detected if not set)

# Agent Configuration
GEMINI_API_KEY=...               # For Gemini agent
OPENAI_API_KEY=...               # For Codex agent

# Session Storage (HTTP mode)
MCP_DATABASE_PATH=/path/to/sessions.db  # Custom database location
# Default: ~/.local/share/mcp-coding-agents/sessions.db (Linux/macOS)
#          %LOCALAPPDATA%\mcp-coding-agents\sessions.db (Windows)
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

## HTTPS Support

The server supports HTTPS for secure communication:

### Quick Start (Auto-Generated Certificate)

```bash
# Run with HTTPS - automatically generates a self-signed certificate
npx @kadreio/mcp-coding-agents http --https
```

This will automatically generate a self-signed certificate on the fly. Perfect for development!

### Using Your Own Certificates

```bash
# Generate self-signed certificates
./generate-certs.sh

# Run with HTTPS using generated certificates
npx @kadreio/mcp-coding-agents http --https --cert ./certs/server.cert --key ./certs/server.key
```

### Using Custom Certificates

```bash
# Run with your own certificates
npx @kadreio/mcp-coding-agents http --https \
  --cert /path/to/certificate.pem \
  --key /path/to/private-key.pem \
  --ca /path/to/ca-certificate.pem  # Optional CA certificate
```

### HTTPS Options

- `--https` - Enable HTTPS mode
- `--cert <path>` - Path to SSL certificate file
- `--key <path>` - Path to SSL private key file
- `--ca <path>` - Path to SSL CA certificate file (optional)

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
## Contributing

Contributions are welcome\! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/kadreio/mcp-coding-agents.git
cd mcp-coding-agents
npm install
npm test
```

### Releasing

Releases are automated via GitHub Actions when you push a version tag:

```bash
npm run release:patch  # 1.0.0 → 1.0.1
npm run release:minor  # 1.0.0 → 1.1.0
npm run release:major  # 1.0.0 → 2.0.0
npm run release:beta   # 1.0.0 → 1.0.1-beta.0
```

See [RELEASING.md](./RELEASING.md) for detailed release instructions.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that bridges Claude Code functionality with the standardized MCP protocol. It provides both HTTP and STDIO transport modes for flexible integration with MCP clients.

## Essential Commands

### Build and Development
```bash
npm run build              # Compile TypeScript to dist/
npm run dev:watch         # Watch mode compilation
```

### Running the Server
```bash
# MCP STDIO mode (for direct MCP client connections)
npm run mcp:dev           # Development mode with ts-node
npm run mcp               # Production mode (requires build)

# MCP HTTP mode (for HTTP-based MCP clients)
npm run mcp:http:dev      # Development mode on port 3050
npm run mcp:http          # Production mode (requires build)

# Express server (legacy HTTP endpoint)
npm run dev               # Development with nodemon
npm run start             # Production mode
```

### Testing
```bash
npm test                  # Run all tests
npm test -- --watch       # Watch mode
npm test tests/unit/claude-code-handler.test.ts  # Run single test file
npm run test:coverage     # Generate coverage report
npm run test:integration  # Run integration tests only
```

### CLI Usage
```bash
# After building, the CLI supports multiple modes:
node dist/cli.js          # Default STDIO mode
node dist/cli.js stdio    # Explicit STDIO mode
node dist/cli.js http     # HTTP MCP server
node dist/cli.js server   # Express server
```

## Architecture Overview

### Transport Layers
The server implements two MCP transport modes:
- **STDIO Mode** (`src/mcp-server.ts`): Direct process communication for MCP clients
- **HTTP Mode** (`src/mcp-server-http.ts`): HTTP/SSE-based transport with session management

### Core Components
- **CLI Entry** (`src/cli.ts`): Spawns appropriate server based on command
- **Configuration** (`src/config/claude-code.ts`): Manages Claude Code settings from environment
- **Tool System**: Extensible tool registration with built-in utilities and Claude Code integration

### Claude Code Integration
The `claude_code_query` tool provides:
- Real-time streaming of Claude responses via MCP notifications
- Configurable permission modes and execution options
- Message filtering and pagination support
- Cancellation support through abort signals

### Session Management (HTTP Mode)
- Sessions created on `initialize` method
- Session ID passed via `Mcp-Session-Id` header
- Notifications streamed via Server-Sent Events

## Environment Configuration

Required:
- `ANTHROPIC_API_KEY` - For Claude Code functionality

Optional:
- `MCP_PORT` (default: 3050) - HTTP MCP server port
- `CLAUDE_CODE_ENABLE` (default: true) - Enable/disable Claude Code tool
- `CLAUDE_CODE_DEFAULT_CWD` - Default working directory for Claude Code
- `CLAUDE_CODE_DEFAULT_MODEL` - Default Claude model
- `CLAUDE_CODE_DEFAULT_PERMISSION_MODE` - Permission mode (default: bypassPermissions)

## Key Implementation Details

### Message Streaming
In HTTP mode, Claude Code messages are streamed as MCP notifications:
1. Tool call initiates Claude Code query
2. Each message is sent as an MCP notification
3. Final result includes filtered messages based on configuration

### Error Handling
- Schema validation for all tool inputs
- Graceful degradation when Claude Code is unavailable
- Proper error responses following MCP protocol

### Testing Approach
- Unit tests focus on schema validation and message handling
- Integration tests verify end-to-end MCP protocol compliance
- Manual test scripts in `tests/scripts/` for debugging specific scenarios

## Development Workflow

1. Make changes to TypeScript source files
2. Run `npm run dev:watch` in one terminal for compilation
3. Run `npm run mcp:http:dev` in another for testing
4. Use `tests/scripts/test-mcp-curl.sh` for quick manual testing
5. Run `npm test` before committing

## Debugging Tips

- Check server logs for detailed error messages
- Use `curl-examples.md` for testing HTTP endpoints
- Enable debug logging by setting appropriate log levels
- For streaming issues, test with `tests/scripts/test-sse.sh`
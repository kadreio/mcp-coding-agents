# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a transport-agnostic MCP (Model Context Protocol) server that bridges Claude Code functionality with the standardized MCP protocol. The architecture cleanly separates business logic from transport concerns, supporting both HTTP and STDIO transport modes for flexible integration with MCP clients.

## Essential Commands

### Build and Development
```bash
npm run build              # Compile TypeScript to dist/
npm run dev:watch         # Watch mode compilation
```

### Running the Server
```bash
# Default mode (HTTP) - for backward compatibility
npm run mcp               # Production mode (requires build)
npm run mcp:dev           # Development mode with ts-node

# STDIO mode - for direct process communication
npm run mcp:stdio         # Production mode (requires build)
npm run mcp:stdio:dev     # Development mode with ts-node

# HTTP mode - for network-based MCP clients
npm run mcp:http          # Production mode (requires build)
npm run mcp:http:dev      # Development mode with ts-node

# Legacy endpoints (deprecated)
npm run mcp:legacy        # Old HTTP server implementation
npm run dev               # Express server with nodemon
npm run start             # Express server production
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
# After building, the unified CLI supports multiple modes:
node dist/cli-unified.js          # Default HTTP mode
node dist/cli-unified.js stdio    # STDIO mode for process communication
node dist/cli-unified.js http     # HTTP mode with SSE support
node dist/cli-unified.js server   # Legacy alias for HTTP mode

# With options:
node dist/cli-unified.js http --port 3051 --host 0.0.0.0
node dist/cli-unified.js --transport stdio
```

## Architecture Overview

### Core Components
- **CoreMCPServer** (`src/core/mcp-server-core.ts`): Transport-agnostic business logic
- **Transport Interface** (`src/core/transport-interface.ts`): Abstract base for transports
- **Transport Factory** (`src/core/transport-factory.ts`): Creates appropriate transport

### Transport Layers
The server implements two MCP transport modes:
- **STDIO Transport** (`src/transports/stdio-transport.ts`): Direct process communication via stdin/stdout
- **HTTP Transport** (`src/transports/http-transport.ts`): HTTP/SSE-based transport with session management

### Additional Components
- **Unified CLI** (`src/cli-unified.ts`): Main entry point with transport selection
- **Legacy CLI** (`src/cli.ts`): Backward compatibility wrapper (deprecated)
- **Configuration** (`src/config/claude-code.ts`): Manages Claude Code settings from environment
- **Tool System**: Extensible tool registration with built-in utilities and agent integrations

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
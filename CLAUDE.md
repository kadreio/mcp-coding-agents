# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a transport-agnostic MCP (Model Context Protocol) server that provides AI coding agents (Claude Code, Gemini, Codex) through a standardized protocol. The architecture cleanly separates business logic from transport concerns, supporting both HTTP/HTTPS and STDIO transport modes.

## Essential Commands

### Build and Development
```bash
npm run build              # Compile TypeScript to dist/
npm run dev:watch         # Watch mode compilation
npm test                  # Run all tests
npm test -- --watch       # Watch mode
npm test tests/unit/claude-code-handler.test.ts  # Run single test file
npm run test:coverage     # Generate coverage report
npm run test:integration  # Run integration tests only
```

### Running the Server
```bash
# Development mode (with ts-node)
npm run mcp:http:dev      # HTTP mode on port 3050
npm run mcp:http:dev -- --https  # HTTPS with auto-generated cert
npm run mcp:stdio:dev     # STDIO mode for direct process communication

# Production mode (requires build)
npm run mcp:http          # HTTP mode
npm run mcp:stdio         # STDIO mode
```

### Release Process
```bash
# Releases are tag-based - push a tag to trigger automated NPM publish
npm run release:patch     # Bug fixes: 1.0.0 → 1.0.1
npm run release:minor     # New features: 1.0.0 → 1.1.0
npm run release:major     # Breaking changes: 1.0.0 → 2.0.0
npm run release:beta      # Pre-release: 1.0.0 → 1.0.1-beta.0
```

## Architecture Overview

The system follows a layered architecture where transport concerns are completely separated from business logic:

```
CLI Entry Point (cli-unified.ts)
        ↓
Transport Factory → Creates Transport Instance
        ↓
Transport Layer (HTTP/STDIO)
        ↓
CoreMCPServer (Business Logic)
        ↓
Agent Handlers (Claude/Gemini/Codex)
```

### Core Architecture Decisions

1. **Transport Agnostic Core**: `CoreMCPServer` contains all MCP protocol logic and tool implementations, with no knowledge of transport specifics.

2. **Session Management**: HTTP transport maintains sessions via `Mcp-Session-Id` header, enabling stateful interactions and SSE streaming.

3. **Agent Integration Pattern**: Each AI agent (Claude, Gemini, Codex) follows the same pattern:
   - Tool definition function returning MCP tool schema
   - Handler function with streaming support via notifications
   - Type guard for argument validation

4. **Streaming Architecture**: 
   - STDIO: Direct JSON-RPC messages
   - HTTP: Server-Sent Events for notifications, with session-based routing

### HTTPS Support

The HTTP transport includes automatic HTTPS support with self-signed certificate generation:
- When `--https` flag is used without certs, generates certificates on the fly
- Uses OpenSSL if available, falls back to embedded certificate
- Supports custom certificates via `--cert` and `--key` options

## Key Implementation Patterns

### Adding New Tools

Tools are registered in `CoreMCPServer.handleListTools()`. Each tool requires:
1. Schema definition in the tools array
2. Handler case in `handleCallTool()` method
3. Optional streaming support via `context.sendNotification`

### Agent Integration

Agents are integrated through a consistent pattern in `src/lib/agents/`:
```typescript
// Tool definition
export function getAgentToolDefinition() { /* returns MCP tool schema */ }

// Type guard
export function isAgentQueryArgs(args: unknown): args is AgentQueryArgs { /* validation */ }

// Handler with streaming
export async function handleAgentQuery(
  args: AgentQueryArgs,
  sendNotification?: (notification: any) => Promise<void>,
  signal?: AbortSignal
): Promise<AgentResult> { /* implementation */ }
```

### Error Handling Strategy

- Transport errors (connection, protocol) handled at transport layer
- Business logic errors thrown as standard errors in CoreMCPServer
- Agent-specific errors include detailed context for debugging

## Environment Configuration

Required:
- `ANTHROPIC_API_KEY` - For Claude Code functionality

Optional:
- `PORT` (default: 3050) - HTTP server port
- `CLAUDE_CODE_ENABLE` (default: true) - Enable/disable Claude Code tool
- `CLAUDE_CODE_DEFAULT_CWD` - Default working directory
- `CLAUDE_CODE_DEFAULT_MODEL` - Default Claude model
- `CLAUDE_CODE_DEFAULT_PERMISSION_MODE` - Permission mode (default: bypassPermissions)
- `CLAUDE_CODE_EXECUTABLE_PATH` - Path to Claude executable (auto-detected via 'which claude' if not set)
- `GEMINI_API_KEY` - For Gemini agent
- `OPENAI_API_KEY` - For Codex agent

## Testing Strategy

### Unit Tests
Focus on individual component behavior:
- Schema validation
- Message filtering logic
- Configuration handling

### Integration Tests
Verify end-to-end MCP protocol compliance:
- Full request/response cycles
- Session management
- Streaming notifications

### Manual Testing
Scripts in `tests/scripts/` for specific scenarios:
- `test-mcp-curl.sh` - Basic MCP operations
- `test-sse.sh` - SSE streaming verification
- `test-claude-code-sse.sh` - Claude Code streaming
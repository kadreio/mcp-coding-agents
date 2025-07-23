---

Created Date: 2025-07-23

# Feature Plan: Expose Claude Code Query Method as MCP Tool

# Overview

We want to expose the @anthropic-ai/claude-code SDK's `query` method as an MCP tool. This will allow MCP clients to interact with Claude Code programmatically, receiving real-time message updates via notifications while the query is processing, and getting a complete message bundle as the final response. This integration will enable Claude Code's powerful capabilities (file editing, command execution, web search, etc.) to be accessible through the MCP protocol.

# Outcomes

- MCP clients can execute Claude Code queries through a standardized tool interface
- Real-time streaming of messages via MCP notifications for immediate feedback
- Complete message history returned as the tool response for processing/logging
- Proper error handling and graceful degradation
- Configurable options for Claude Code behavior (cwd, permissions, allowed tools, etc.)
- Support for query interruption/cancellation

# Open Questions

[x] Should we expose all Claude Code options or start with a subset?
Start with safe subset: cwd, maxTurns, model, appendSystemPrompt. Add permission controls later.

[x] How should we handle the AbortController for cancellation - via a separate tool or parameter?
Use MCP's built-in request cancellation mechanism. No separate tool needed.

[x] Should we implement authentication/authorization for this tool?
Yes, at MCP server level. Add config option to enable/disable tool.

[x] What notification channel/topic should we use for message streaming?
Use "claude-code/messages" topic for clear namespace separation.

[x] Should we support streaming prompts (AsyncIterable<SDKUserMessage>) or just string prompts initially?
String prompts only initially. Add streaming support later if needed.

[x] How should we handle large message histories that might exceed response size limits?
Return last N messages (default 100), include summary and truncation info.

[x] Should we implement rate limiting or usage tracking?
Basic execution logging and metrics only. Defer rate limiting to server level.

[x] Do we need to sanitize/filter certain message types or content?
Minimal filtering - only remove sensitive data like API keys in errors.

# Tasks

[ ] Install @anthropic-ai/claude-code as a dependency

[ ] Define the tool schema for the query endpoint
  - Input parameters (prompt, options)
  - Output schema (message bundle)

[ ] Implement the query tool handler
  - Initialize Claude Code query with provided options
  - Handle async generator iteration
  - Emit notifications for each message
  - Collect messages for final response

[ ] Define notification schema for streamed messages
  - Message type differentiation
  - Consistent format for all message types

[ ] Implement error handling
  - Query initialization errors
  - Runtime errors during execution
  - Timeout handling
  - Graceful degradation

[ ] Add abort/cancellation support
  - Design cancellation mechanism (separate tool or request metadata)
  - Implement AbortController integration
  - Handle cleanup on cancellation

[ ] Create comprehensive tests
  - Unit tests for message handling
  - Integration tests with mock Claude Code responses
  - Error scenario testing
  - Notification emission testing

[ ] Add configuration support
  - Environment variables for default options
  - Per-request option overrides
  - Security policy configuration

[ ] Document the tool
  - Usage examples
  - Available options
  - Message type descriptions
  - Best practices

[ ] Implement usage logging/metrics
  - Query count
  - Execution time
  - Error rates
  - Resource usage

# Security

- **Command Execution**: Claude Code can execute shell commands. We need to carefully consider which options to expose and potentially implement additional sandboxing
- **File System Access**: Claude Code can read/write files. Path restrictions and permission controls are critical
- **API Key Management**: Ensure Claude Code API keys are properly secured and not exposed to clients
- **Resource Limits**: Implement timeouts and resource constraints to prevent abuse
- **Input Validation**: Validate all input parameters to prevent injection attacks
- **Output Sanitization**: Consider filtering sensitive information from responses
- **Audit Logging**: Log all query executions for security monitoring

# Message Types and Notification Format

## Notification Schema
```typescript
interface ClaudeCodeNotification {
  type: 'claude_code_message';
  sessionId: string;
  message: SDKMessage; // The actual Claude Code message
  timestamp: string;
  sequence: number; // Message sequence number
}
```

## Tool Response Schema
```typescript
interface ClaudeCodeQueryResponse {
  sessionId: string;
  messages: SDKMessage[];
  executionTime: number;
  usage?: NonNullableUsage;
  result?: {
    success: boolean;
    summary: string;
    error?: string;
  };
}
```

# Configuration Options

## Environment Variables
```env
CLAUDE_CODE_DEFAULT_CWD=/workspace
CLAUDE_CODE_MAX_EXECUTION_TIME=300000
CLAUDE_CODE_DEFAULT_PERMISSION_MODE=default
CLAUDE_CODE_ALLOWED_TOOLS=read,write,edit,grep,glob
```

## Tool Options Schema (Initial Implementation)
```typescript
interface ClaudeCodeQueryOptions {
  // Core options (v1)
  cwd?: string;              // Working directory for Claude Code
  maxTurns?: number;         // Maximum conversation turns
  model?: string;            // Model to use (e.g., 'claude-3-opus')
  appendSystemPrompt?: string; // Additional system instructions
  
  // Response options
  maxMessages?: number;      // Max messages to return (default: 100)
  includeSystemMessages?: boolean; // Include system messages (default: true)
  
  // Future options (v2)
  // permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  // allowedTools?: string[];
  // disallowedTools?: string[];
}
```

# Error Handling Strategy

1. **Initialization Errors**: Return immediate error response with clear message
2. **Runtime Errors**: Emit error notification and include in final response
3. **Timeout Errors**: Abort query and return partial results with timeout indication
4. **Network Errors**: Implement retry logic with exponential backoff
5. **Resource Errors**: Graceful degradation with informative error messages

# Implementation Notes

- Use the MCP Server's notification system for real-time updates
- Implement proper cleanup in finally blocks
- Consider implementing a session manager for tracking active queries
- Add prometheus metrics for monitoring
- Ensure proper TypeScript types throughout
- Follow existing codebase patterns for consistency
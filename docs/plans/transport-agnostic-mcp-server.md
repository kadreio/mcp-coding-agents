---

Created Date 2025-07-31

# Feature Plan: Transport-Agnostic MCP Server Architecture

# Overview

Currently, our MCP server implementation is tightly coupled to HTTP transport. We want to refactor the architecture to support multiple transport modes (STDIO and HTTP) while maintaining a single core implementation. This will allow users to choose the most appropriate transport for their use case: STDIO for direct process communication (common in editor integrations) and HTTP for network-based access (useful for remote connections and web integrations).

# Outcomes

- Single core MCP server implementation that is transport-agnostic
- Clean separation between business logic and transport concerns
- Support for both STDIO and HTTP transports with identical functionality
- Simplified maintenance with reduced code duplication
- Easy addition of new transport types in the future
- Consistent behavior across all transport modes

# Open Questions

[x] Should we maintain backward compatibility with the current CLI arguments, or is it okay to introduce breaking changes?
**Answer**: Maintain backward compatibility by accepting legacy commands (stdio, http, server) as positional arguments

[x] Do we need to support simultaneous STDIO and HTTP modes, or is exclusive mode sufficient?
**Answer**: Exclusive mode is sufficient for initial implementation

[x] How should we handle transport-specific features (e.g., SSE streaming in HTTP, direct stdio streaming)?
**Answer**: Abstract to common notification interface, transports handle delivery optimally

[x] Should session management be abstracted or remain transport-specific?
**Answer**: Keep session management transport-specific (STDIO doesn't need it, HTTP does)

[x] Do we want to support configuration file for transport settings, or keep it CLI-based only?
**Answer**: CLI-based only for initial implementation

[x] Should agent configurations (Claude, Gemini, Codex) be shared across transports or configurable per-transport?
**Answer**: Share agent configurations across transports for consistency

# Tasks

[x] Create core MCP server class that encapsulates all business logic
  - Extract tool definitions and handlers ✓
  - Extract prompt definitions and handlers ✓
  - Extract resource definitions and handlers ✓
  - Move agent integrations (Claude, Gemini, Codex) to core ✓

[x] Define transport interface/abstract class
  - Common methods for initialization ✓
  - Request/response handling abstraction ✓
  - Notification/streaming abstraction ✓
  - Session management interface (optional per transport) ✓

[x] Implement STDIO transport adapter
  - Create StdioTransport class implementing transport interface ✓
  - Handle JSON-RPC over stdin/stdout ✓
  - Implement notification streaming for STDIO ✓
  - Add proper error handling and graceful shutdown ✓

[x] Refactor HTTP transport adapter
  - Create HttpTransport class implementing transport interface ✓
  - Preserve existing SSE streaming functionality ✓
  - Maintain session management capabilities ✓
  - Keep CORS and middleware configuration ✓

[x] Update CLI to support transport selection
  - Add transport mode argument (stdio/http) ✓
  - Preserve existing HTTP-specific options (port, etc.) ✓
  - Add STDIO-specific options if needed ✓
  - Update help documentation ✓

[x] Create transport factory
  - Factory method to create appropriate transport based on CLI args ✓
  - Inject core server instance into transport ✓
  - Handle transport-specific configuration ✓

[ ] Update tests for both transports
  - Create shared test suite for core functionality
  - Add transport-specific tests for STDIO
  - Update existing HTTP transport tests
  - Ensure all agents work in both modes

[ ] Update documentation
  - Update README.md with new CLI options
  - Update CLAUDE.md with architecture changes
  - Add examples for both transport modes
  - Document transport-specific features/limitations

[ ] Add integration tests
  - Test switching between transports
  - Verify feature parity between transports
  - Test error scenarios in both modes

# Security

- STDIO mode: Ensure proper input validation as it bypasses network security layers
- HTTP mode: Maintain existing CORS and authentication mechanisms
- Validate all inputs regardless of transport to prevent injection attacks
- Consider rate limiting for both transports to prevent resource exhaustion
- Ensure sensitive data (API keys) are handled securely in both modes

# Architecture Design

## Current Architecture
```
cli.ts -> mcp-server-http.ts -> Express -> StreamableHTTPServerTransport -> MCP SDK
                              -> Agents (Claude, Gemini, Codex)
```

## Proposed Architecture
```
cli.ts -> TransportFactory -> StdioTransport -> CoreMCPServer -> Agents
                          \-> HttpTransport  /
                           
CoreMCPServer:
- Tool definitions & handlers
- Prompt definitions & handlers  
- Resource definitions & handlers
- Agent integrations
- Business logic

Transport Interface:
- initialize()
- handleRequest()
- sendNotification()
- close()
```

# Implementation Notes

1. The MCP SDK already provides transport abstractions (`StdioServerTransport` and `StreamableHTTPServerTransport`), so we should leverage these rather than reinventing the wheel.

2. The core server should be initialized once and passed to the transport layer, ensuring consistent state management.

3. Special attention needed for streaming/notifications as they work differently:
   - STDIO: Direct write to stdout with proper message framing
   - HTTP: SSE (Server-Sent Events) for real-time updates

4. Session management is primarily an HTTP concern for stateless request/response cycles. STDIO is inherently stateful through the process lifetime.

# Testing Framework and Strategy

## Testing Framework Selection

### Primary Framework: Jest
- **Rationale**: Already in use, good TypeScript support, comprehensive mocking capabilities
- **Coverage Tool**: Built-in Jest coverage with Istanbul
- **Test Runner**: Jest with parallel execution for speed
- **Assertion Library**: Jest's built-in expect API + custom matchers for MCP protocol

### Supporting Tools
- **Supertest**: For HTTP transport testing
- **Mock-stdin**: For STDIO transport testing  
- **@modelcontextprotocol/sdk**: Official SDK for protocol compliance testing
- **Sinon**: Advanced mocking for agent interactions
- **Jest-extended**: Additional matchers for better assertions

## Test Structure

```
tests/
├── unit/
│   ├── core/
│   │   ├── mcp-server-core.test.ts
│   │   ├── tool-handlers.test.ts
│   │   ├── prompt-handlers.test.ts
│   │   └── resource-handlers.test.ts
│   ├── agents/
│   │   ├── claude.test.ts
│   │   ├── gemini.test.ts
│   │   └── codex.test.ts
│   ├── transports/
│   │   ├── transport-interface.test.ts
│   │   ├── stdio-transport.test.ts
│   │   └── http-transport.test.ts
│   └── utils/
│       ├── transport-factory.test.ts
│       └── config-loader.test.ts
├── integration/
│   ├── stdio/
│   │   ├── stdio-server.test.ts
│   │   ├── stdio-streaming.test.ts
│   │   └── stdio-cancellation.test.ts
│   ├── http/
│   │   ├── http-server.test.ts
│   │   ├── http-sse.test.ts
│   │   ├── http-sessions.test.ts
│   │   └── http-cors.test.ts
│   └── cross-transport/
│       ├── feature-parity.test.ts
│       ├── agent-compatibility.test.ts
│       └── protocol-compliance.test.ts
├── e2e/
│   ├── cli-stdio.test.ts
│   ├── cli-http.test.ts
│   ├── client-compatibility.test.ts
│   └── real-world-scenarios.test.ts
├── performance/
│   ├── throughput.test.ts
│   ├── latency.test.ts
│   ├── memory-usage.test.ts
│   └── concurrent-requests.test.ts
├── fixtures/
│   ├── mock-responses/
│   ├── test-prompts/
│   └── sample-data/
└── helpers/
    ├── test-client.ts
    ├── mock-agents.ts
    └── protocol-validator.ts
```

## Testing Categories

### 1. Unit Tests (70% coverage target)

**Core Server Tests**
- Tool registration and execution
- Prompt management and interpolation
- Resource handling
- Request routing
- Error handling
- Configuration merging

**Agent Tests**
- Message parsing and formatting
- Stream handling
- Timeout management
- Cancellation behavior
- Error propagation

**Transport Tests**
- Request/response mapping
- Notification delivery
- Session management (HTTP)
- Stream framing (STDIO)
- Error serialization

### 2. Integration Tests (20% coverage target)

**Protocol Compliance**
- JSON-RPC 2.0 compliance
- MCP protocol specification adherence
- Message ordering guarantees
- Error code standards

**Transport-Specific Features**
- STDIO: Bidirectional streaming, signal handling
- HTTP: SSE streaming, CORS, session persistence

**Cross-Transport Compatibility**
- Feature parity verification
- Consistent error handling
- Identical tool behavior

### 3. End-to-End Tests (10% coverage target)

**CLI Testing**
- Mode selection and initialization
- Configuration loading
- Graceful shutdown
- Signal handling

**Client Scenarios**
- Real MCP client connections
- Multi-turn conversations
- Concurrent requests
- Long-running operations

### 4. Performance Tests

**Metrics to Track**
- Request throughput (req/sec)
- Response latency (p50, p95, p99)
- Memory usage over time
- CPU utilization
- Concurrent connection limits

**Benchmarks**
- Baseline: Current HTTP-only implementation
- Target: No more than 5% regression
- Stretch: 10% improvement through optimizations

## Test Implementation Strategy

### Phase 1: Test Infrastructure (Week 1)
- [ ] Set up test directory structure
- [ ] Create test helpers and utilities
- [ ] Implement protocol validator
- [ ] Create mock agent implementations
- [ ] Set up coverage reporting

### Phase 2: Core Unit Tests (Week 2)
- [ ] Write tests for CoreMCPServer
- [ ] Test all tool handlers
- [ ] Test prompt system
- [ ] Test resource handlers
- [ ] Achieve 80% unit test coverage

### Phase 3: Transport Tests (Week 3)
- [ ] Test transport interface contract
- [ ] STDIO transport unit tests
- [ ] HTTP transport unit tests
- [ ] Transport factory tests
- [ ] Mock-based integration tests

### Phase 4: Integration Tests (Week 4)
- [ ] Cross-transport feature parity tests
- [ ] Protocol compliance tests
- [ ] Agent integration tests
- [ ] Session management tests
- [ ] Streaming/notification tests

### Phase 5: E2E and Performance (Week 5)
- [ ] CLI end-to-end tests
- [ ] Client compatibility tests
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Memory leak detection

## Testing Patterns and Best Practices

### Test Patterns
```typescript
// Shared test suite for transport-agnostic features
describe.each(['stdio', 'http'])('%s transport', (transportType) => {
  let server: TestServer;
  
  beforeEach(() => {
    server = createTestServer(transportType);
  });
  
  test('should handle tool execution', async () => {
    // Test implementation
  });
});

// Contract testing for transport interface
interface TransportContract {
  initialize(): Promise<void>;
  handleRequest(request: any): Promise<any>;
  sendNotification(notification: any): Promise<void>;
  close(): Promise<void>;
}

function testTransportContract(createTransport: () => TransportContract) {
  // Shared contract tests
}
```

### Mock Strategies
```typescript
// Agent mocking
class MockClaudeAgent {
  async *query(prompt: string) {
    yield { type: 'thinking', content: 'Processing...' };
    yield { type: 'response', content: 'Mock response' };
  }
}

// Transport mocking
class MockTransport implements Transport {
  requests: any[] = [];
  notifications: any[] = [];
  
  async handleRequest(request: any) {
    this.requests.push(request);
    return { success: true };
  }
}
```

### Assertion Helpers
```typescript
// Protocol validation
expect(response).toBeValidMCPResponse();
expect(notification).toMatchMCPSchema('notification');

// Transport-specific assertions
expect(stdioOutput).toHaveCorrectFraming();
expect(httpResponse).toHaveSSEFormat();
```

## Continuous Integration

### CI Pipeline
```yaml
test:
  stages:
    - lint
    - unit-tests
    - integration-tests
    - e2e-tests
    - performance-tests
    - coverage-report

unit-tests:
  script:
    - npm run test:unit
  coverage: '/Coverage: \d+\.\d+%/'

integration-tests:
  script:
    - npm run test:integration
  needs: [unit-tests]

e2e-tests:
  script:
    - npm run test:e2e
  needs: [integration-tests]
  
performance-tests:
  script:
    - npm run test:performance
    - npm run benchmark:compare
  artifacts:
    reports:
      performance: performance-report.json
```

### Quality Gates
- Minimum 70% overall coverage
- No reduction in coverage per PR
- All tests must pass
- Performance regression < 5%
- No memory leaks detected

## Test Data Management

### Fixtures
- Standardized test prompts
- Mock agent responses
- Sample MCP requests/responses
- Error scenarios

### Test Isolation
- Each test creates fresh server instance
- No shared state between tests
- Automatic cleanup in afterEach
- Deterministic test execution

### Test Doubles
- Stubs for external dependencies
- Mocks for agent interactions
- Fakes for transport layer during unit tests
- Spies for event tracking

## Debugging and Troubleshooting

### Debug Modes
```bash
# Verbose test output
DEBUG=mcp:* npm test

# Single test file
npm test -- --testPathPattern=stdio-transport

# Watch mode for development
npm test -- --watch

# Coverage with detailed report
npm test -- --coverage --coverageReporters=html
```

### Test Utilities
```typescript
// Test timeout helpers
withTimeout(5000, async () => {
  await longRunningOperation();
});

// Retry mechanism for flaky tests
await retryAsync(3, async () => {
  await unstableOperation();
});

// Debug logging
debug('mcp:test')('Request: %j', request);
```

## Monitoring Test Health

### Metrics to Track
- Test execution time trends
- Flaky test identification
- Coverage trends
- Test-to-code ratio
- Time to run full suite

### Regular Maintenance
- Weekly review of flaky tests
- Monthly coverage audit
- Quarterly performance baseline update
- Bi-annual test suite refactoring

# Implementation Status

## Completed (2025-07-31)

### Core Architecture ✅
- Created `CoreMCPServer` class in `src/core/mcp-server-core.ts`
- Extracted all business logic from HTTP-specific implementation
- Maintains all existing functionality (tools, resources, prompts)
- Successfully integrated all agents (Claude, Gemini, Codex)

### Transport Layer ✅
- Created abstract `MCPTransport` interface in `src/core/transport-interface.ts`
- Implemented `HttpTransport` in `src/transports/http-transport.ts`
  - Preserves all existing HTTP/SSE functionality
  - Maintains session management
  - CORS support configurable
- Implemented `StdioTransport` in `src/transports/stdio-transport.ts`
  - Full JSON-RPC over stdin/stdout
  - Proper signal handling for graceful shutdown
  
### CLI Integration ✅
- Created unified CLI in `src/cli-unified.ts`
- Backward compatible with existing commands
- Supports both positional arguments and flags
- Commander-based for better argument parsing

### Testing Status
- Both transports successfully tested manually:
  - HTTP: `node dist/cli-unified.js http --port 3051` ✅
  - STDIO: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize"...}' | node dist/cli-unified.js stdio` ✅
- Unit tests need Jest configuration updates for ESM modules

## Next Steps

1. Update package.json to use cli-unified.ts as main entry point
2. Migrate existing tests to work with new architecture
3. Add comprehensive test coverage for both transports
4. Update documentation (README.md, CLAUDE.md)
5. Consider deprecating old entry points after transition period

# Migration Path

1. Phase 1: Extract core server without breaking existing HTTP functionality ✅
2. Phase 2: Implement STDIO transport alongside HTTP ✅
3. Phase 3: Update CLI to support both modes ✅
4. Phase 4: Deprecation notices for any breaking changes (pending)
5. Phase 5: Full release with documentation (pending)
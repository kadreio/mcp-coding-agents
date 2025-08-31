---

Created Date 2025-08-09

# Feature Plan: Remove BMI Tool

# Overview

The BMI (Body Mass Index) calculator tool is a simple utility within the MCP server that calculates BMI based on height and weight inputs. This plan outlines the complete removal of this tool from the codebase. The BMI tool appears to be a demonstration/example tool that doesn't align with the core purpose of the SIAI project (AI coding agents integration). Removing it will simplify the codebase and focus the tool offerings on AI agent capabilities.

# Outcomes

- Clean removal of all BMI-related code from the codebase
- Updated tests to reflect the removal
- Updated documentation without BMI references
- Maintained backward compatibility considerations for existing clients
- Simplified tool list focusing on core AI agent functionality

# Open Questions

[ ] Should we notify users about the deprecation before removal?

[ ] Are there any production systems currently using the BMI tool that need migration time?

[ ] Should we version this as a breaking change (major version bump)?

[ ] Do we need to add deprecation warnings first before complete removal?

# Tasks

[ ] Remove BMI tool definition from CoreMCPServer (`src/core/mcp-server-core.ts:117-127`)

[ ] Remove BMI handler implementation from CoreMCPServer (`src/core/mcp-server-core.ts:185-207`)

[ ] Remove BMI from HTTP transport capabilities list (`src/transports/http-transport.ts:206`)

[ ] Remove legacy BMI code from old HTTP server file (`src/mcp-server-http.ts:51-62`, `117-138`, `554`)

[ ] Update integration tests to remove BMI test cases (`tests/integration/mcp-server.test.ts:89`, `98-113`, `136-140`)

[ ] Update Claude Code integration tests (`tests/integration/claude-code-integration.test.ts:110`, `114-130`, `132-137`)

[ ] Update test scripts to remove BMI examples:
  - `tests/scripts/test-mcp-curl.sh:51-66`
  - `tests/scripts/test-sse.sh:63-65`
  - `tests/scripts/test-with-session.sh:50-63`
  - `tests/scripts/quick-test.sh:38-45`

[ ] Update README.md to remove BMI tool from features list (`README.md:14`, `79`)

[ ] Update curl-examples.md to remove BMI example (`curl-examples.md:43-55`)

[ ] Run full test suite to ensure no broken references

[ ] Update changelog to document the removal

[ ] Consider adding migration guide if needed

# Security

- No security implications for removal
- Ensure removal doesn't expose any internal implementation details in error messages

# Testing Strategy

1. **Pre-removal Testing**
   - Run full test suite to establish baseline
   - Document current test coverage

2. **Post-removal Testing**
   - Verify all tests pass after BMI removal
   - Test error handling for clients attempting to use removed BMI tool
   - Verify tool list no longer includes BMI

3. **Integration Testing**
   - Test with various transport modes (HTTP, STDIO)
   - Verify capability negotiation works correctly
   - Test with existing client implementations

# Backward Compatibility Considerations

- Clients attempting to call `calculate_bmi` will receive standard "tool not found" error
- Consider if we need graceful error message mentioning tool removal
- Document removal clearly in release notes

# Implementation Order

1. Start with test removal to establish expected behavior
2. Remove handler implementation
3. Remove tool definition
4. Update documentation
5. Clean up any remaining references
6. Final testing and validation
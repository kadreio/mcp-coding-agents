// Mock implementation of @anthropic-ai/claude-code for testing

const mockQuery = jest.fn().mockImplementation(async function* (prompt, options = {}) {
  // Default mock implementation that yields some test messages
  yield {
    type: 'system',
    subtype: 'init',
    session_id: 'test-session-id',
    tools: ['Task', 'Bash', 'Read', 'Write'],
    mcp_servers: [],
    cwd: options.cwd || process.cwd(),
    model: options.model || 'claude-3-opus',
    permissionMode: options.permissionMode || 'bypassPermissions',
    apiKeySource: 'test'
  };
  
  yield {
    type: 'user',
    text: prompt
  };
  
  yield {
    type: 'assistant',
    text: 'Mock response from Claude'
  };
  
  return {
    messages: [],
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150
    }
  };
});

// Mock SDKMessage types
const mockSDKMessage = {};

module.exports = {
  query: mockQuery,
  SDKMessage: mockSDKMessage,
  // Reset function for tests
  __resetMock: () => {
    mockQuery.mockClear();
  }
};
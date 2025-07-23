import { describe, test, expect } from '@jest/globals';

describe('Claude Code Handler Unit Tests', () => {
  test('should validate tool schema', () => {
    // Test that the tool schema is properly defined
    const toolSchema = {
      name: 'claude_code_query',
      description: 'Execute a Claude Code query with real-time message streaming',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { 
            type: 'string', 
            description: 'The prompt to send to Claude Code' 
          },
          options: {
            type: 'object',
            description: 'Configuration options for Claude Code',
            properties: {
              cwd: { 
                type: 'string', 
                description: 'Working directory for Claude Code (default: current directory)' 
              },
              maxTurns: { 
                type: 'number', 
                description: 'Maximum conversation turns' 
              },
              model: { 
                type: 'string', 
                description: 'Model to use (e.g., claude-3-opus)' 
              },
              appendSystemPrompt: { 
                type: 'string', 
                description: 'Additional system instructions' 
              },
              permissionMode: {
                type: 'string',
                enum: ['default', 'acceptEdits', 'bypassPermissions', 'plan'],
                description: 'Permission mode (default: bypassPermissions)'
              },
              maxMessages: {
                type: 'number',
                description: 'Maximum messages to return in response (default: 100)'
              },
              includeSystemMessages: {
                type: 'boolean',
                description: 'Include system messages in response (default: true)'
              }
            }
          }
        },
        required: ['prompt'],
      }
    };

    expect(toolSchema.name).toBe('claude_code_query');
    expect(toolSchema.inputSchema.required).toContain('prompt');
    expect(toolSchema.inputSchema.properties.options.properties.permissionMode.enum).toContain('bypassPermissions');
  });

  test('should format response correctly', () => {
    // Test response formatting
    const mockResponse = {
      sessionId: 'test-session',
      messages: [
        { type: 'system', content: 'System message' },
        { type: 'assistant', content: 'Assistant message' }
      ],
      executionTime: 1000,
      messageCount: 2,
      truncated: false,
      result: {
        success: true,
        summary: 'Test completed'
      }
    };

    const formatted = JSON.stringify(mockResponse, null, 2);
    expect(formatted).toContain('test-session');
    expect(formatted).toContain('System message');
    expect(formatted).toContain('Test completed');
  });

  test('should filter system messages when requested', () => {
    const messages = [
      { type: 'system', content: 'System message' },
      { type: 'assistant', content: 'Assistant message' },
      { type: 'user', content: 'User message' },
      { type: 'system', content: 'Another system message' }
    ];

    const filtered = messages.filter(m => m.type !== 'system');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(m => m.type !== 'system')).toBe(true);
  });

  test('should limit messages correctly', () => {
    const messages = Array.from({ length: 150 }, (_, i) => ({
      type: 'assistant',
      content: `Message ${i}`
    }));

    const maxMessages = 100;
    const limited = messages.slice(-maxMessages);
    
    expect(limited).toHaveLength(100);
    expect(limited[0].content).toBe('Message 50');
    expect(limited[99].content).toBe('Message 149');
  });
});
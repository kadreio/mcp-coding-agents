import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Mock the claude-code module to avoid requiring API keys during tests
jest.mock('@anthropic-ai/claude-code', () => ({
  query: jest.fn().mockImplementation(({ prompt }: any) => {
    // Return a mock async generator
    return (async function* () {
      // System message
      yield {
        type: 'system',
        subtype: 'init',
        apiKeySource: 'test',
        cwd: '/test',
        session_id: 'test-session',
        tools: ['read', 'write'],
        mcp_servers: [],
        model: 'test-model',
        permissionMode: 'bypassPermissions'
      };

      // Assistant message
      yield {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I'll help you with: ${prompt}`
            }
          ]
        },
        parent_tool_use_id: null,
        session_id: 'test-session'
      };

      // Result message
      yield {
        type: 'result',
        subtype: 'success',
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        result: 'Task completed successfully',
        session_id: 'test-session',
        total_cost_usd: 0.01,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      };
    })();
  })
}));

describe('Claude Code Query Tool Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  const serverPort = 3051; // Use different port to avoid conflicts

  beforeAll(async () => {
    // Start the MCP server as a separate process
    const serverPath = path.join(__dirname, '../../src/mcp-server-http.ts');
    serverProcess = spawn('ts-node', [serverPath], {
      env: { ...process.env, MCP_PORT: String(serverPort) },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within timeout'));
      }, 10000);

      serverProcess.stdout?.on('data', (data) => {
        console.log('Server output:', data.toString());
        if (data.toString().includes('MCP Streamable HTTP Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Give the server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create client with streamable HTTP transport
    transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${serverPort}/mcp`)
    );
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Connect the client
    await client.connect(transport);
    console.log('Client connected for Claude Code tests');
  }, 30000);

  afterAll(async () => {
    // Close client connection
    if (client) {
      await client.close();
    }

    // Kill the server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });

  test('should list claude_code_query tool', async () => {
    const response = await client.listTools();
    
    const claudeCodeTool = response.tools.find(t => t.name === 'claude_code_query');
    expect(claudeCodeTool).toBeDefined();
    expect(claudeCodeTool?.description).toBe('Execute a Claude Code query with real-time message streaming');
  });

  test('should execute Claude Code query successfully', async () => {
    const result = await client.callTool({
      name: 'claude_code_query',
      arguments: {
        prompt: 'Test prompt',
        options: {
          permissionMode: 'bypassPermissions',
          maxMessages: 5
        }
      }
    });

    expect(result.content).toHaveLength(1);
    expect((result.content as any)[0].type).toBe('text');
    
    const response = JSON.parse((result.content as any)[0].text);
    expect(response).toHaveProperty('sessionId');
    expect(response).toHaveProperty('messages');
    expect(response).toHaveProperty('executionTime');
    expect(response).toHaveProperty('result');
    
    // Check messages
    expect(response.messages).toBeInstanceOf(Array);
    expect(response.messages.length).toBeGreaterThan(0);
    
    // Check result
    expect(response.result).toHaveProperty('success', true);
    expect(response.result).toHaveProperty('summary');
  });

  test('should handle query with custom options', async () => {
    const result = await client.callTool({
      name: 'claude_code_query',
      arguments: {
        prompt: 'Create a Python script',
        options: {
          cwd: '/tmp',
          model: 'claude-3-opus',
          appendSystemPrompt: 'Be concise',
          maxMessages: 10,
          includeSystemMessages: false
        }
      }
    });

    const response = JSON.parse((result.content as any)[0].text);
    
    // When includeSystemMessages is false, system messages should be filtered out
    const systemMessages = response.messages.filter((m: any) => m.type === 'system');
    expect(systemMessages).toHaveLength(0);
  });

  test('should handle errors gracefully', async () => {
    // Mock an error scenario
    const mockQuery = require('@anthropic-ai/claude-code').query as jest.Mock;
    mockQuery.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    const result = await client.callTool({
      name: 'claude_code_query',
      arguments: {
        prompt: 'This will fail'
      }
    });

    const response = JSON.parse((result.content as any)[0].text);
    expect(response).toHaveProperty('error', 'Test error');
    expect(response.result).toHaveProperty('success', false);
    expect(response.result).toHaveProperty('error', 'Test error');
  });

  test('should handle missing prompt', async () => {
    await expect(client.callTool({
      name: 'claude_code_query',
      arguments: {}
    })).rejects.toThrow();
  });
});
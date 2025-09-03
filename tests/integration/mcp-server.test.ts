import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('MCP Streamable HTTP Server Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  const serverPort = 3050; // Using the default MCP port

  beforeAll(async () => {
    // Start the MCP server using the unified CLI in HTTP mode
    const serverPath = path.join(__dirname, '../../src/cli-unified.ts');
    serverProcess = spawn('ts-node', [serverPath, 'http', '--port', String(serverPort)], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within timeout'));
      }, 10000);

      serverProcess.stdout?.on('data', (data) => {
        console.log('Server output:', data.toString());
        if (data.toString().includes('MCP HTTP Server running') || data.toString().includes('MCP HTTPS Server running')) {
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
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create client with streamable HTTP transport
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues in CI
    transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${serverPort}/mcp`)
    );
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Connect the client (this will handle initialization automatically)
    await client.connect(transport);
    console.log('Client connected and initialized');
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

  describe('Tools', () => {
    test('should list available tools', async () => {
      const response = await client.listTools();
      
      console.log('Available tools:', response.tools.map(t => t.name));
      
      expect(response.tools).toHaveLength(4);
      expect(response.tools.map(t => t.name)).toContain('execute_command');
      expect(response.tools.map(t => t.name)).toContain('claude_code_query');
      expect(response.tools.map(t => t.name)).toContain('gemini_query');
      expect(response.tools.map(t => t.name)).toContain('codex_query');
    });

    test('should execute command successfully', async () => {
      const result = await client.callTool({
        name: 'execute_command',
        arguments: {
          command: 'echo "Hello, World!"'
        }
      });

      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0].type).toBe('text');
      
      const textContent = (result.content as any)[0] as { type: 'text'; text: string };
      expect(textContent.text.trim()).toBe('Hello, World!');
    });

    test('should handle invalid tool name', async () => {
      await expect(client.callTool({
        name: 'invalid_tool',
        arguments: {}
      })).rejects.toThrow();
    });

    test('should handle missing required parameters', async () => {
      await expect(client.callTool({
        name: 'execute_command',
        arguments: {} // missing command
      })).rejects.toThrow();
    });
  });

  describe('Resources', () => {
    test('should list available resources', async () => {
      const response = await client.listResources();
      
      expect(response.resources).toHaveLength(2);
      expect(response.resources.map(r => r.uri)).toContain('config://server');
      expect(response.resources.map(r => r.uri)).toContain('stats://system');
    });

    test('should read server configuration', async () => {
      const result = await client.readResource({
        uri: 'config://server'
      });

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('config://server');
      expect(result.contents[0].mimeType).toBe('application/json');
      
      const config = JSON.parse((result.contents as any)[0].text!);
      expect(config.name).toBe('@kadreio/mcp-coding-agents');
      expect(config.version).toBe('1.0.0');
    });

    test('should read system statistics', async () => {
      const result = await client.readResource({
        uri: 'stats://system'
      });

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('stats://system');
      expect(result.contents[0].mimeType).toBe('application/json');
      
      const stats = JSON.parse((result.contents as any)[0].text!);
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('timestamp');
    });

    test('should handle invalid resource URI', async () => {
      await expect(client.readResource({
        uri: 'invalid://resource'
      })).rejects.toThrow();
    });
  });

  describe('Prompts', () => {
    test('should list available prompts', async () => {
      const response = await client.listPrompts();
      
      expect(response.prompts).toHaveLength(8);
      expect(response.prompts.map(p => p.name)).toContain('commit');
      expect(response.prompts.map(p => p.name)).toContain('plan');
    });

    test('should get commit prompt', async () => {
      const result = await client.getPrompt({
        name: 'commit',
        arguments: {}
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      
      const content = result.messages[0].content as { type: 'text'; text: string };
      expect(content.text).toContain('Bundle all outstanding');
    });

    test('should get plan prompt', async () => {
      const result = await client.getPrompt({
        name: 'plan',
        arguments: { feature_description: 'User authentication system' }
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      
      const content = result.messages[0].content as { type: 'text'; text: string };
      expect(content.text).toContain('User authentication system');
    });

    test('should handle invalid prompt name', async () => {
      await expect(client.getPrompt({
        name: 'invalid_prompt',
        arguments: {}
      })).rejects.toThrow();
    });
  });
});
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Claude Code Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  const serverPort = 3059; // Use unique port
  const CLI_PATH = path.join(__dirname, '../../dist/cli-unified.js');
  
  // Skip if not built
  const skipIfNotBuilt = !fs.existsSync(CLI_PATH);

  (skipIfNotBuilt ? describe.skip : describe)('with running server', () => {
    beforeAll(async () => {
      // Start the MCP server
      serverProcess = spawn('node', [CLI_PATH, 'http', '--port', String(serverPort)], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverStarted = false;
      let output = '';

      // Capture output
      serverProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        if (text.includes('MCP HTTP Server running') || text.includes('MCP HTTPS Server running') || 
            output.includes('MCP HTTP Server running') || output.includes('MCP HTTPS Server running')) {
          serverStarted = true;
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });

      // Wait for server to start
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (serverStarted) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (serverStarted) {
            resolve();
          } else {
            reject(new Error(`Server failed to start. Output: ${output}`));
          }
        }, 8000);
      });

      // Give server a moment to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if process is still running
      if (serverProcess.killed) {
        throw new Error('Server process was killed unexpectedly');
      }
      
      // Create and connect client
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
      
      await client.connect(transport);
    }, 20000);

    afterAll(async () => {
      if (client) {
        await client.close();
      }
      
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }
    });

    test('should list available tools including claude_code_query', async () => {
      const response = await client.listTools();
      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      
      const toolNames = response.tools.map(t => t.name);
      expect(toolNames).toContain('claude_code_query');
      expect(toolNames).toContain('gemini_query');
      expect(toolNames).toContain('codex_query');
      expect(toolNames).toContain('execute_command');
    });

    test('should execute execute_command tool', async () => {
      const result = await client.callTool({
        name: 'execute_command',
        arguments: {
          command: 'echo "Test output"'
        }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const content = result.content as any[];
      expect(content[0]).toBeDefined();
      expect(content[0].type).toBe('text');
      expect(content[0].text.trim()).toBe('Test output');
    });

    test('should handle tool with missing arguments', async () => {
      await expect(client.callTool({
        name: 'execute_command',
        arguments: {
          // missing command
        }
      })).rejects.toThrow();
    });

    test('should list available prompts', async () => {
      const response = await client.listPrompts();
      expect(response).toBeDefined();
      expect(response.prompts).toBeDefined();
      expect(Array.isArray(response.prompts)).toBe(true);
      
      const promptNames = response.prompts.map(p => p.name);
      expect(promptNames).toContain('commit');
      expect(promptNames).toContain('plan');
      expect(promptNames).toContain('examine');
    });

    test('should get a specific prompt', async () => {
      const response = await client.getPrompt({
        name: 'plan',
        arguments: {
          feature_description: 'Test feature'
        }
      });

      expect(response).toBeDefined();
      expect(response.messages).toBeDefined();
      expect(response.messages.length).toBeGreaterThan(0);
      expect(response.messages[0].content.text).toContain('Test feature');
    });

    test('should list available resources', async () => {
      const response = await client.listResources();
      expect(response).toBeDefined();
      expect(response.resources).toBeDefined();
      expect(Array.isArray(response.resources)).toBe(true);
      
      const resourceUris = response.resources.map(r => r.uri);
      expect(resourceUris).toContain('config://server');
      expect(resourceUris).toContain('stats://system');
    });

    test('should read a resource', async () => {
      const response = await client.readResource({
        uri: 'config://server'
      });

      expect(response).toBeDefined();
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      
      const content = JSON.parse((response.contents as any)[0].text);
      expect(content.name).toBe('@kadreio/mcp-coding-agents');
      expect(content.version).toBe('1.0.0');
    });
  });
});
import { spawn } from 'child_process';
import path from 'path';

describe('Unified CLI Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli-unified.js');
  const TIMEOUT = 15000;

  afterEach(async () => {
    // Small delay between tests to avoid port conflicts
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Command line interface', () => {
    test('should show help message with --help flag', async () => {
      const child = spawn('node', [CLI_PATH, '--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(0);
          expect(output).toContain('Usage: @kadreio/mcp-coding-agents');
          expect(output).toContain('Transport mode (stdio or http)');
          expect(output).toContain('--port');
          expect(output).toContain('--host');
          resolve();
        });
      });
    }, TIMEOUT);

    test('should start HTTP server by default', async () => {
      const testPort = 3055; // Use unique port for this test
      const child = spawn('node', [CLI_PATH, '--port', String(testPort)], {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let started = false;
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('MCP HTTP Server running')) {
          started = true;
        }
      });
      
      child.stderr?.on('data', (data) => {
        console.error('Test stderr:', data.toString());
      });
      
      // Wait for server to start
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (started) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
      
      expect(started).toBe(true);
      expect(output).toContain(`MCP HTTP Server running`);
      expect(output).toContain(String(testPort));
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should start STDIO server with explicit command', async () => {
      const child = spawn('node', [CLI_PATH, 'stdio'], {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // STDIO server should respond to initialize
      const testMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      }) + '\n';
      
      let response = '';
      child.stdout?.on('data', (data) => {
        response += data.toString();
      });
      
      // Small delay to ensure process is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      child.stdin?.write(testMessage);
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(response).toContain('"jsonrpc":"2.0"');
      expect(response).toContain('"result"');
      expect(response).toContain('serverInfo');
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should start HTTP server when specified', async () => {
      const testPort = 3056;
      const child = spawn('node', [CLI_PATH, 'http', '--port', testPort.toString()], {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let started = false;
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('MCP HTTP Server running')) {
          started = true;
        }
      });

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (started) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      expect(started).toBe(true);
      expect(output).toContain(String(testPort));
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should handle legacy server command', async () => {
      const testPort = 3057;
      const child = spawn('node', [CLI_PATH, 'server', '--port', String(testPort)], {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let hasDeprecationMessage = false;
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('deprecated')) {
          hasDeprecationMessage = true;
        }
      });
      
      child.stderr?.on('data', (data) => {
        output += data.toString();
        if (output.includes('deprecated')) {
          hasDeprecationMessage = true;
        }
      });

      // Wait for deprecation message and server start
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (hasDeprecationMessage && output.includes('MCP HTTP Server')) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      expect(hasDeprecationMessage).toBe(true);
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);
  });

  describe('Transport modes', () => {
    test('should accept --transport flag for stdio', async () => {
      const child = spawn('node', [CLI_PATH, '--transport', 'stdio'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Test that STDIO server responds
      const testMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      }) + '\n';
      
      let response = '';
      child.stdout?.on('data', (data) => {
        response += data.toString();
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      child.stdin?.write(testMessage);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(response).toContain('"jsonrpc"');
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should handle port configuration for HTTP', async () => {
      const testPort = 3058;
      const child = spawn('node', [CLI_PATH, 'http', '--port', testPort.toString()], {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let started = false;
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('MCP HTTP Server running') && output.includes(String(testPort))) {
          started = true;
        }
      });

      // Wait for server to start with the specified port
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (started) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      expect(started).toBe(true);
      expect(output).toContain(String(testPort));
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);
  });
});
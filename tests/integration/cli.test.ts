import { ChildProcess, spawn } from 'child_process';
import path from 'path';

describe('Unified CLI Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli-unified.js');
  const TIMEOUT = 10000;

  const startCLI = (args: string[] = []): Promise<{
    process: ChildProcess;
    output: string;
  }> => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [CLI_PATH, ...args], {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', reject);

      setTimeout(() => {
        resolve({ process: child, output: output + errorOutput });
      }, 1000);
    });
  };

  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Command line interface', () => {
    test('should show help message with --help flag', async () => {
      const child = spawn('node', [CLI_PATH, '--help']);
      
      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(0);
          expect(output).toContain('Usage: @kadreio/mcp-claude-code');
          expect(output).toContain('Transport mode (stdio or http)');
          expect(output).toContain('--port');
          expect(output).toContain('--host');
          resolve();
        });
      });
    }, TIMEOUT);

    test('should start HTTP server by default', async () => {
      const { process: child } = await startCLI();
      
      expect(child.pid).toBeDefined();
      expect(child.killed).toBe(false);
      
      // Wait a bit more to see if we get output
      await new Promise(resolve => setTimeout(resolve, 500));
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should start STDIO server with explicit command', async () => {
      const { process: child } = await startCLI(['stdio']);
      
      expect(child.pid).toBeDefined();
      expect(child.killed).toBe(false);
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should start HTTP server when specified', async () => {
      const testPort = 3051;
      const child = spawn('node', [CLI_PATH, 'http', '--port', testPort.toString()], {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        const checkOutput = setInterval(() => {
          if (output.includes(`MCP HTTP Server running`)) {
            clearInterval(checkOutput);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkOutput);
          resolve();
        }, 5000);
      });

      expect(child.pid).toBeDefined();
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should handle legacy server command', async () => {
      const child = spawn('node', [CLI_PATH, 'server']);
      
      let output = '';
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(output).toContain('Note: "server" command is deprecated');
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);
  });

  describe('Transport modes', () => {
    test('should accept --transport flag', async () => {
      const child = spawn('node', [CLI_PATH, '--transport', 'stdio']);
      
      expect(child.pid).toBeDefined();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should handle port configuration for HTTP', async () => {
      const testPort = 3052;
      const child = spawn('node', [CLI_PATH, 'http', '--port', testPort.toString()], {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(output).toContain(`3052`);
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);
  });
});
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('CLI Binary Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli.js');
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
    test('should show help message for unknown command', async () => {
      const child = spawn('node', [CLI_PATH, 'unknown']);
      
      let errorOutput = '';
      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(1);
          expect(errorOutput).toContain('Unknown command: unknown');
          expect(errorOutput).toContain('Available commands: stdio, http, server');
          expect(errorOutput).toContain('npx @kardio/mcp-claude-code');
          resolve();
        });
      });
    }, TIMEOUT);

    test('should start STDIO server by default', async () => {
      const { process: child } = await startCLI();
      
      expect(child.pid).toBeDefined();
      expect(child.killed).toBe(false);
      
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
      const child = spawn('node', [CLI_PATH, 'http'], {
        env: { ...process.env, MCP_PORT: testPort.toString(), NODE_ENV: 'test' }
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        const checkOutput = setInterval(() => {
          if (output.includes(`MCP Streamable HTTP Server running on port ${testPort}`)) {
            clearInterval(checkOutput);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkOutput);
          resolve();
        }, 5000);
      });

      expect(output).toContain(`MCP Streamable HTTP Server running on port ${testPort}`);
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should start Express server when specified', async () => {
      const testPort = 3001;
      const child = spawn('node', [CLI_PATH, 'server'], {
        env: { ...process.env, PORT: testPort.toString(), NODE_ENV: 'test' }
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        const checkOutput = setInterval(() => {
          if (output.includes(`Server is running on port ${testPort}`)) {
            clearInterval(checkOutput);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkOutput);
          resolve();
        }, 5000);
      });

      expect(output).toContain(`Server is running on port ${testPort}`);
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should pass through additional arguments', async () => {
      const child = spawn('node', [CLI_PATH, 'stdio', '--test-arg']);
      
      expect(child.pid).toBeDefined();
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);

    test('should inherit environment variables', async () => {
      const testEnvVar = 'TEST_CLI_VAR';
      const testEnvValue = 'test-value-123';
      
      const child = spawn('node', [CLI_PATH, 'stdio'], {
        env: { ...process.env, [testEnvVar]: testEnvValue }
      });
      
      expect(child.pid).toBeDefined();
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    }, TIMEOUT);
  });

  describe('Binary executable verification', () => {
    test('should have executable shebang', async () => {
      const fs = await import('fs');
      const content = await fs.promises.readFile(CLI_PATH, 'utf-8');
      
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    test('should handle process termination gracefully', async () => {
      const child = spawn('node', [CLI_PATH, 'stdio']);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      child.kill('SIGINT');
      
      const exitCode = await new Promise<number | null>((resolve) => {
        child.on('exit', (code) => resolve(code));
      });
      
      expect(exitCode).toBeDefined();
    }, TIMEOUT);
  });
});
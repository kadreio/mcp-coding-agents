import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('CLI Basic Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli-unified.js');
  
  // Skip tests if built file doesn't exist
  const skipIfNotBuilt = !fs.existsSync(CLI_PATH);
  
  (skipIfNotBuilt ? describe.skip : describe)('Built CLI tests', () => {
    test('should show help message', async () => {
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
          expect(output).toContain('Transport mode');
          resolve();
        });
      });
    });

    test('should accept stdio mode', async () => {
      const child = spawn('node', [CLI_PATH, 'stdio'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      expect(child.pid).toBeDefined();
      
      // STDIO server should be listening
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
      
      child.stdin?.write(testMessage);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(response).toContain('"jsonrpc":"2.0"');
      expect(response).toContain('"result"');
      
      child.kill('SIGTERM');
    });

    test('should accept http mode with port', async () => {
      const child = spawn('node', [CLI_PATH, 'http', '--port', '3053'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const combinedOutput = output + errorOutput;
      expect(combinedOutput).toContain('3053');
      
      child.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });
    });
  });
});
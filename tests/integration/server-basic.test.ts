import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

describe('Server Basic Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/cli-unified.js');
  let serverProcess: ChildProcess | null = null;

  afterEach(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
    serverProcess = null;
    // Wait between tests to avoid port conflicts
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('HTTP server should start and respond to health check', async () => {
    const port = 3062;
    
    // Start server
    serverProcess = spawn('node', [CLI_PATH, 'http', '--port', String(port)], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverStarted = false;
    
    // Capture output
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('MCP HTTP Server running')) {
        serverStarted = true;
      }
    });

    // Wait for server to start
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (serverStarted) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    expect(serverStarted).toBe(true);

    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test health endpoint
    const healthResponse = await new Promise<any>((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: '/health',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    expect(healthResponse).toBeDefined();
    expect(healthResponse.status).toBe('OK');
    expect(healthResponse.service).toBe('MCP Server');
    expect(healthResponse.transport).toBe('HTTP');
  }, 15000);

  test('STDIO server should respond to initialize', async () => {
    // Start STDIO server
    serverProcess = spawn('node', [CLI_PATH, 'stdio'], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait a moment for process to start
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send initialize request
    const request = JSON.stringify({
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
    serverProcess.stdout?.on('data', (data) => {
      response += data.toString();
    });

    serverProcess.stdin?.write(request);

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(response).toContain('"jsonrpc":"2.0"');
    expect(response).toContain('"id":1');
    expect(response).toContain('"result"');
    expect(response).toContain('serverInfo');
    expect(response).toContain('@kadreio/mcp-coding-agents');
  }, 10000);
});
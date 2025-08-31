import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response, Application } from 'express';
import { MCPTransport, TransportConfig } from '../core/transport-interface';
import { CoreMCPServer } from '../core/mcp-server-core';
import * as promptsData from '../lib/prompts.json';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { generateSelfSignedCertificate } from '../utils/self-signed-cert';
import { createClaudeCodeApi, ClaudeCodeApiConfig } from '../api/claude-code-api';
import { setupSwaggerMiddleware, SwaggerMiddlewareConfig } from '../middleware/swagger-middleware';
import { ApiInfoResponse } from '../api/types';

export interface HttpTransportConfig extends TransportConfig {
  port?: number;
  host?: string;
  cors?: boolean;
  https?: boolean;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  claudeCodeApi?: ClaudeCodeApiConfig & { enabled?: boolean };
  swagger?: SwaggerMiddlewareConfig;
}

/**
 * HTTP Transport implementation for MCP Server
 * Supports SSE streaming and session management
 */
export class HttpTransport extends MCPTransport {
  private app: Application;
  private server: http.Server | https.Server | null = null;
  private transports: Map<string, StreamableHTTPServerTransport>;
  private sharedTransport: StreamableHTTPServerTransport | null;
  private port: number;
  private host: string;
  private useHttps: boolean;
  private httpsOptions: https.ServerOptions | null = null;
  private running: boolean = false;

  constructor(coreServer: CoreMCPServer, config: HttpTransportConfig = {}) {
    super(coreServer, config);
    this.port = config.port || parseInt(process.env.MCP_PORT || '3050', 10);
    this.host = config.host || '0.0.0.0';
    this.useHttps = config.https || false;
    this.app = express();
    this.transports = new Map();
    this.sharedTransport = null;

    // Configure HTTPS options if enabled
    if (this.useHttps) {
      this.httpsOptions = {};
      
      if (config.certPath && config.keyPath) {
        // Use provided certificate paths
        try {
          this.httpsOptions.cert = fs.readFileSync(config.certPath);
          this.httpsOptions.key = fs.readFileSync(config.keyPath);
          if (config.caPath) {
            this.httpsOptions.ca = fs.readFileSync(config.caPath);
          }
        } catch (error) {
          console.error('Failed to read certificate files:', error);
          throw error;
        }
      }
      // If no certs provided, we'll generate them on demand in start()
    }
  }

  async initialize(): Promise<void> {
    // Configure middleware
    this.app.use(express.json());

    // CORS middleware if enabled
    if (this.config.cors !== false) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
        res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Set up routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Mount Claude Code REST API if enabled
    if (this.config.claudeCodeApi?.enabled !== false) {
      const claudeCodeRouter = createClaudeCodeApi(this.config.claudeCodeApi || {});
      this.app.use('/api/v1', claudeCodeRouter);
      console.log('Claude Code REST API mounted at /api/v1');
    }

    // Setup Swagger documentation if enabled
    setupSwaggerMiddleware(this.app, this.config.swagger);

    // MCP endpoint handler
    this.app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      const acceptHeader = req.headers['accept'] as string;

      console.log(`Received MCP request${sessionId ? ` for session: ${sessionId}` : ''}`);
      console.log('Request method:', req.body?.method);
      console.log('Accept header:', acceptHeader);

      // Check if client supports SSE
      const supportsSSE = acceptHeader && acceptHeader.includes('text/event-stream');
      console.log('Client SSE support:', supportsSSE ? 'YES - Client can receive streaming responses' : 'NO - Client only supports JSON responses');

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport
          transport = this.transports.get(sessionId)!;
        } else if (isInitializeRequest(req.body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId: string) => {
              console.log(`Session initialized with ID: ${newSessionId}`);
              this.transports.set(newSessionId, transport);
            }
          });

          // Set up cleanup handler
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports.has(sid)) {
              console.log(`Transport closed for session ${sid}, removing from transports map`);
              this.transports.delete(sid);
            }
          };

          // Connect the transport to the core MCP server instance
          const mcpServer = this.coreServer.getServer();
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return;
        } else {
          // For non-initialization requests without session ID, use shared transport
          if (!this.sharedTransport) {
            console.log('Creating shared transport for sessionless/stateless mode');
            this.sharedTransport = new StreamableHTTPServerTransport({
              sessionIdGenerator: undefined
            });
            const mcpServer = this.coreServer.getServer();
            await mcpServer.connect(this.sharedTransport);
          }
          transport = this.sharedTransport;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Handle GET requests for SSE streams
    this.app.get('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)!;
        console.log(`Establishing SSE stream for session ${sessionId}`);
      } else if (this.sharedTransport) {
        // Use shared transport for sessionless mode
        transport = this.sharedTransport;
        console.log('Establishing SSE stream using shared transport');
      } else {
        res.status(400).send('No transport available');
        return;
      }

      await transport.handleRequest(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'OK',
        service: 'MCP Server',
        transport: 'HTTP',
        timestamp: new Date().toISOString(),
        activeSessions: this.transports.size,
        apis: {
          mcp: {
            enabled: true,
            endpoint: '/mcp'
          },
          claudeCode: {
            enabled: this.config.claudeCodeApi?.enabled !== false,
            endpoint: '/api/v1'
          }
        }
      });
    });

    // Root endpoint with API info
    this.app.get('/', (_req: Request, res: Response) => {
      const response: ApiInfoResponse = {
        name: '@kadreio/mcp-claude-code',
        version: '1.0.0',
        transport: 'HTTP',
        apis: {
          mcp: {
            endpoint: '/mcp',
            capabilities: {
              tools: ['calculate_bmi', 'get_timestamp', 'execute_command', 'stream_sse_timestamps', 'claude_code_query', 'gemini_query', 'codex_query'],
              resources: ['config://server', 'stats://system'],
              prompts: Object.keys(promptsData.prompts)
            }
          }
        }
      };

      // Add Claude Code API info if enabled
      if (this.config.claudeCodeApi?.enabled !== false) {
        response.apis.claudeCode = {
          endpoint: '/api/v1',
          documentation: '/api/v1/docs',
          endpoints: [
            'POST /api/v1/sessions',
            'GET /api/v1/sessions',
            'GET /api/v1/sessions/:id',
            'DELETE /api/v1/sessions/:id',
            'POST /api/v1/sessions/:id/messages',
            'POST /api/v1/sessions/:id/stream',
            'GET /api/v1/models',
            'GET /api/v1/health'
          ]
        };
      }

      res.json(response);
    });
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('HTTP transport is already running');
    }

    return new Promise(async (resolve, reject) => {
      const callback = () => {
        const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
        const protocol = this.useHttps ? 'https' : 'http';
        console.log(`🚀 MCP ${protocol.toUpperCase()} Server running on ${protocol}://${displayHost}:${this.port}`);
        console.log(`📡 MCP endpoint: ${protocol}://${displayHost}:${this.port}/mcp`);
        if (this.config.claudeCodeApi?.enabled !== false) {
          console.log(`🤖 Claude Code API: ${protocol}://${displayHost}:${this.port}/api/v1`);
        }
        console.log(`❤️  Health check: ${protocol}://${displayHost}:${this.port}/health`);
        if (this.useHttps && !(this.config as HttpTransportConfig).certPath) {
          console.warn('⚠️  Using auto-generated self-signed certificate. For production, provide your own certificates.');
          console.warn('   To trust this certificate in your browser, you may need to accept the security warning.');
        }
        this.running = true;
        resolve();
      };

      try {
        if (this.useHttps) {
          // Generate self-signed certificate if none provided
          if (!this.httpsOptions?.cert || !this.httpsOptions?.key) {
            console.log('🔐 Generating self-signed certificate for HTTPS...');
            const selfSigned = await generateSelfSignedCertificate();
            this.httpsOptions = {
              ...this.httpsOptions,
              cert: selfSigned.cert,
              key: selfSigned.key
            };
          }
          this.server = https.createServer(this.httpsOptions, this.app);
        } else {
          this.server = http.createServer(this.app);
        }
        
        this.server.listen(this.port, this.host, callback);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    return new Promise((resolve) => {
      // Close all transports
      for (const [sessionId, transport] of this.transports) {
        console.log(`Closing transport for session ${sessionId}`);
        if (transport.onclose) {
          transport.onclose();
        }
      }
      this.transports.clear();

      // Close shared transport if exists
      if (this.sharedTransport?.onclose) {
        this.sharedTransport.onclose();
        this.sharedTransport = null;
      }

      // Close the HTTP/HTTPS server
      if (this.server) {
        this.server.close(() => {
          const protocol = this.useHttps ? 'HTTPS' : 'HTTP';
          console.log(`${protocol} transport stopped`);
          this.running = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getType(): string {
    return 'http';
  }

  isRunning(): boolean {
    return this.running;
  }
}
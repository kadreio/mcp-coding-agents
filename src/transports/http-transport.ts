import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response, Application } from 'express';
import { MCPTransport, TransportConfig } from '../core/transport-interface';
import { CoreMCPServer } from '../core/mcp-server-core';
import * as promptsData from '../lib/prompts.json';

export interface HttpTransportConfig extends TransportConfig {
  port?: number;
  host?: string;
  cors?: boolean;
}

/**
 * HTTP Transport implementation for MCP Server
 * Supports SSE streaming and session management
 */
export class HttpTransport extends MCPTransport {
  private app: Application;
  private server: any;
  private transports: Map<string, StreamableHTTPServerTransport>;
  private sharedTransport: StreamableHTTPServerTransport | null;
  private port: number;
  private host: string;
  private running: boolean = false;

  constructor(coreServer: CoreMCPServer, config: HttpTransportConfig = {}) {
    super(coreServer, config);
    this.port = config.port || parseInt(process.env.MCP_PORT || '3050', 10);
    this.host = config.host || '0.0.0.0';
    this.app = express();
    this.transports = new Map();
    this.sharedTransport = null;
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
      });
    });

    // Root endpoint with API info
    this.app.get('/', (_req: Request, res: Response) => {
      // For now, return static info. We can enhance this later to query the core server
      res.json({
        name: '@kadreio/mcp-claude-code',
        version: '1.0.0',
        transport: 'HTTP',
        endpoint: '/mcp',
        capabilities: {
          tools: ['calculate_bmi', 'get_timestamp', 'execute_command', 'stream_sse_timestamps', 'claude_code_query', 'gemini_query', 'codex_query'],
          resources: ['config://server', 'stats://system'],
          prompts: Object.keys(promptsData.prompts)
        }
      });
    });
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('HTTP transport is already running');
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, this.host, () => {
        const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
        console.log(`🚀 MCP HTTP Server running on http://${displayHost}:${this.port}`);
        console.log(`📡 MCP endpoint: http://${displayHost}:${this.port}/mcp`);
        console.log(`❤️  Health check: http://${displayHost}:${this.port}/health`);
        this.running = true;
        resolve();
      });
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

      // Close the HTTP server
      this.server.close(() => {
        console.log('HTTP transport stopped');
        this.running = false;
        resolve();
      });
    });
  }

  getType(): string {
    return 'http';
  }

  isRunning(): boolean {
    return this.running;
  }
}
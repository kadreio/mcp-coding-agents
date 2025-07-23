import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  isInitializeRequest,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

// Load environment variables
dotenv.config();

const app = express();
const MCP_PORT = parseInt(process.env.MCP_PORT || '3050', 10);

// Map to store transports by session ID
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

// Create and configure MCP server
function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'example-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    }
  );

  // Define available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'calculate_bmi',
          description: 'Calculate Body Mass Index (BMI)',
          inputSchema: {
            type: 'object',
            properties: {
              weight: { type: 'number', description: 'Weight in kilograms' },
              height: { type: 'number', description: 'Height in meters' },
            },
            required: ['weight', 'height'],
          },
        },
        {
          name: 'get_timestamp',
          description: 'Get the current timestamp',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'execute_command',
          description: 'Execute a shell command synchronously and return its output',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The shell command to execute' },
              cwd: { type: 'string', description: 'Working directory for command execution (optional)' },
              timeout: { type: 'number', description: 'Command timeout in milliseconds (optional, default: 30000)' },
            },
            required: ['command'],
          },
        },
        {
          name: 'stream_sse_timestamps',
          description: 'Generate 10 timestamps stremaing',
          inputSchema: {
            type: 'object',
            properties: {
              delay: { type: 'number', description: 'Delay between timestamps in milliseconds (default: 1000)' },
            },
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'calculate_bmi': {
        const weight = args?.weight as number;
        const height = args?.height as number;
        
        if (!weight || !height) {
          throw new Error('Weight and height are required');
        }
        
        const bmi = weight / (height * height);
        const category = 
          bmi < 18.5 ? 'Underweight' :
          bmi < 25 ? 'Normal weight' :
          bmi < 30 ? 'Overweight' : 'Obese';
        
        return {
          content: [
            {
              type: 'text',
              text: `BMI: ${bmi.toFixed(2)} (${category})`,
            },
          ],
        };
      }
      
      case 'get_timestamp': {
        return {
          content: [
            {
              type: 'text',
              text: new Date().toISOString(),
            },
          ],
        };
      }
      
      case 'execute_command': {
        const command = args?.command as string;
        const cwd = args?.cwd as string | undefined;
        const timeout = args?.timeout as number | undefined || 30000;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        // Log the incoming request
        console.log(`[execute_command] Request received:`, {
          command,
          cwd: cwd || 'current directory',
          timeout
        });
        
        try {
          const startTime = Date.now();
          const output = execSync(command, {
            encoding: 'utf8',
            cwd: cwd || process.cwd(),
            timeout: timeout,
            stdio: 'pipe',
          });
          
          const executionTime = Date.now() - startTime;
          
          // Log the command response
          console.log(`[execute_command] Command executed successfully in ${executionTime}ms:`, {
            command,
            outputLength: output.length,
            outputPreview: output.slice(0, 200) + (output.length > 200 ? '...' : '')
          });
          
          const response = {
            content: [
              {
                type: 'text',
                text: output || 'Command executed successfully with no output',
              },
            ],
          };
          
          // Log when response is sent
          console.log(`[execute_command] Response sent for command: ${command}`);
          
          return response;
        } catch (error: any) {
          const errorMessage = error.stderr || error.message || 'Command execution failed';
          const exitCode = error.status !== undefined ? error.status : 'unknown';
          
          // Log the error
          console.log(`[execute_command] Command failed:`, {
            command,
            exitCode,
            errorMessage
          });
          
          const response = {
            content: [
              {
                type: 'text',
                text: `Command failed with exit code ${exitCode}: ${errorMessage}`,
              },
            ],
          };
          
          // Log when error response is sent
          console.log(`[execute_command] Error response sent for command: ${command}`);
          
          return response;
        }
      }
      
      case 'stream_sse_timestamps': {
        const delay = (args?.delay as number) || 1000;
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const sendNotification = extra?.sendNotification;
        
        // Check if we can stream (requires sendNotification)
        if (sendNotification) {
          console.log('Streaming timestamps via SSE notifications');
          
          // Send initial notification
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: "Starting timestamp stream..."
            }
          });
          
          // Stream timestamps via notifications
          for (let i = 1; i <= 10; i++) {
            const timestamp = new Date().toISOString();
            const data = {
              timestamp,
              counter: i,
              message: `Event ${i} of 10`
            };
            
            await sendNotification({
              method: "notifications/message",
              params: {
                level: "info",
                data: JSON.stringify(data)
              }
            });
            
            console.log(`Streamed timestamp ${i}: ${timestamp}`);
            
            if (i < 10) {
              await sleep(delay);
            }
          }
          
          // Return final summary
          return {
            content: [
              {
                type: 'text',
                text: 'Successfully streamed 10 timestamps via SSE',
              },
            ],
          };
        } else {
          console.log('No SSE support - returning all timestamps at once');
          
          // Fallback: Generate all timestamps with delays
          const timestamps = [];
          
          for (let i = 1; i <= 10; i++) {
            timestamps.push({
              timestamp: new Date().toISOString(),
              counter: i,
              message: `Event ${i} of 10`
            });
            
            if (i < 10) {
              await sleep(delay);
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Generated 10 timestamps with ${delay}ms delays:\n\n${JSON.stringify(timestamps, null, 2)}`,
              },
            ],
          };
        }
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Define available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'config://server',
          name: 'Server Configuration',
          description: 'Current server configuration',
          mimeType: 'application/json',
        },
        {
          uri: 'stats://system',
          name: 'System Statistics',
          description: 'Current system statistics',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'config://server':
        return {
          contents: [
            {
              uri: 'config://server',
              mimeType: 'application/json',
              text: JSON.stringify({
                name: 'example-mcp-server',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                port: process.env.MCP_PORT || '3050',
              }, null, 2),
            },
          ],
        };

      case 'stats://system':
        return {
          contents: [
            {
              uri: 'stats://system',
              mimeType: 'application/json',
              text: JSON.stringify({
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  // Define available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'analyze_data',
          description: 'Analyze data and provide insights',
          arguments: [
            {
              name: 'data_type',
              description: 'Type of data to analyze',
              required: true,
            },
          ],
        },
        {
          name: 'debug_issue',
          description: 'Help debug an issue',
          arguments: [
            {
              name: 'error_message',
              description: 'The error message or issue description',
              required: true,
            },
          ],
        },
      ],
    };
  });

  // Handle prompt requests
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'analyze_data':
        return {
          description: 'Analyze data and provide insights',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please analyze the following ${args?.data_type || 'data'} and provide insights, patterns, and recommendations.`,
              },
            },
          ],
        };

      case 'debug_issue':
        return {
          description: 'Help debug an issue',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `I'm encountering the following issue: ${args?.error_message || 'Unknown error'}. Please help me debug this by analyzing potential causes and suggesting solutions.`,
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  return server;
}

// Middleware
app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
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

// Create a shared transport for sessionless mode
let sharedTransport: StreamableHTTPServerTransport | null = null;
let sharedServer: Server | null = null;

// MCP endpoint handler
app.post('/mcp', async (req: Request, res: Response) => {
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
    
    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else if (isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          console.log(`Session initialized with ID: ${newSessionId}`);
          transports.set(newSessionId, transport);
        }
      });
      
      // Set up cleanup handler
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          transports.delete(sid);
        }
      };
      
      // Connect the transport to a new MCP server instance
      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      // For non-initialization requests without session ID, use shared transport
      // This supports clients that don't handle sessions properly
      if (!sharedTransport) {
        console.log('Creating shared transport for sessionless/stateless mode');
        // Create transport with undefined sessionIdGenerator for stateless mode
        sharedTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined
        });
        sharedServer = createMCPServer();
        await sharedServer.connect(sharedTransport);
      }
      transport = sharedTransport;
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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    service: 'MCP Server',
    transport: 'Streamable HTTP',
    timestamp: new Date().toISOString(),
    activeSessions: transports.size,
  });
});

// Root endpoint with API info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'example-mcp-server',
    version: '1.0.0',
    transport: 'Streamable HTTP',
    endpoint: '/mcp',
    capabilities: {
      tools: ['calculate_bmi', 'get_timestamp', 'execute_command', 'stream_sse_timestamps'],
      resources: ['config://server', 'stats://system'],
      prompts: ['analyze_data', 'debug_issue']
    }
  });
});

// Handle GET requests for SSE streams
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  let transport: StreamableHTTPServerTransport;
  
  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!;
    console.log(`Establishing SSE stream for session ${sessionId}`);
  } else if (sharedTransport) {
    // Use shared transport for sessionless mode
    transport = sharedTransport;
    console.log('Establishing SSE stream using shared transport');
  } else {
    res.status(400).send('No transport available');
    return;
  }
  
  await transport.handleRequest(req, res);
});

// Start the HTTP server
app.listen(MCP_PORT, () => {
  console.log(`🚀 MCP Streamable HTTP Server running on port ${MCP_PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
  console.log(`❤️  Health check: http://localhost:${MCP_PORT}/health`);
});
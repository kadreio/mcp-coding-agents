import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { query as claudeQuery, type SDKMessage } from '@anthropic-ai/claude-code';

// Create server instance
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
        name: 'claude_code_query',
        description: 'Execute a Claude Code query with real-time message streaming',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { 
              type: 'string', 
              description: 'The prompt to send to Claude Code' 
            },
            options: {
              type: 'object',
              description: 'Configuration options for Claude Code',
              properties: {
                cwd: { 
                  type: 'string', 
                  description: 'Working directory for Claude Code (default: current directory)' 
                },
                maxTurns: { 
                  type: 'number', 
                  description: 'Maximum conversation turns' 
                },
                model: { 
                  type: 'string', 
                  description: 'Model to use (e.g., claude-3-opus)' 
                },
                appendSystemPrompt: { 
                  type: 'string', 
                  description: 'Additional system instructions' 
                },
                permissionMode: {
                  type: 'string',
                  enum: ['default', 'acceptEdits', 'bypassPermissions', 'plan'],
                  description: 'Permission mode (default: bypassPermissions)'
                },
                maxMessages: {
                  type: 'number',
                  description: 'Maximum messages to return in response (default: 100)'
                },
                includeSystemMessages: {
                  type: 'boolean',
                  description: 'Include system messages in response (default: true)'
                }
              }
            }
          },
          required: ['prompt'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  const signal = extra?.signal;

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
    
    case 'claude_code_query': {
      const prompt = args?.prompt as string;
      const options = args?.options as any || {};
      
      // Set default options
      const queryOptions = {
        cwd: options.cwd || process.cwd(),
        permissionMode: options.permissionMode || 'bypassPermissions',
        maxTurns: options.maxTurns,
        model: options.model,
        appendSystemPrompt: options.appendSystemPrompt,
        // Add AbortController for cancellation support
        abortController: new AbortController()
      };
      
      // Response configuration
      const maxMessages = options.maxMessages || 100;
      const includeSystemMessages = options.includeSystemMessages !== false;
      
      // Track execution
      const sessionId = randomUUID();
      const messages: SDKMessage[] = [];
      let sequence = 0;
      const startTime = Date.now();
      
      console.error(`[claude_code_query] Starting query session ${sessionId}:`, {
        prompt: prompt.substring(0, 100) + '...',
        options: queryOptions
      });
      
      // Handle cancellation from MCP client
      if (signal) {
        signal.addEventListener('abort', () => {
          console.error(`[claude_code_query] Cancellation requested for session ${sessionId}`);
          queryOptions.abortController.abort();
        });
      }
      
      try {
        // Initialize the Claude Code query
        const query = claudeQuery({
          prompt,
          options: queryOptions as any
        });
        
        // Process messages from the async generator
        for await (const message of query) {
          // Check if cancelled
          if (signal?.aborted) {
            console.error(`[claude_code_query] Query cancelled for session ${sessionId}`);
            break;
          }
          messages.push(message);
          sequence++;
          
          // For stdio transport, we can't send real-time notifications
          // Just log the message
          console.error(`[claude_code_query] Message ${sequence} (${message.type}):`, {
            sessionId,
            messageType: message.type
          });
        }
        
        // Filter messages based on options
        let responseMessages = messages;
        if (!includeSystemMessages) {
          responseMessages = messages.filter(m => m.type !== 'system');
        }
        
        // Limit messages if needed
        let truncated = false;
        if (responseMessages.length > maxMessages) {
          responseMessages = responseMessages.slice(-maxMessages);
          truncated = true;
        }
        
        // Calculate execution time
        const executionTime = Date.now() - startTime;
        
        // Extract result from the last message if it's a result type
        const lastMessage = messages[messages.length - 1];
        let result;
        if (signal?.aborted) {
          result = {
            success: false,
            summary: 'Query cancelled by user',
            error: 'cancelled'
          };
        } else if (lastMessage?.type === 'result') {
          const resultMessage = lastMessage as any;
          result = {
            success: !resultMessage.is_error,
            summary: resultMessage.result || 'Query completed',
            error: resultMessage.is_error ? resultMessage.subtype : undefined
          };
        }
        
        console.error(`[claude_code_query] Query completed:`, {
          sessionId,
          totalMessages: messages.length,
          executionTime,
          result
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId,
                messages: responseMessages,
                executionTime,
                messageCount: messages.length,
                truncated,
                result
              }, null, 2)
            }
          ]
        };
        
      } catch (error: any) {
        const isCancellation = error.name === 'AbortError' || signal?.aborted;
        
        console.error(`[claude_code_query] Query ${isCancellation ? 'cancelled' : 'failed'}:`, {
          sessionId,
          error: error.message,
          errorName: error.name
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId,
                error: error.message,
                executionTime: Date.now() - startTime,
                messages: messages.slice(-maxMessages), // Include partial results
                messageCount: messages.length,
                result: {
                  success: false,
                  summary: isCancellation ? 'Query cancelled' : 'Query failed',
                  error: isCancellation ? 'cancelled' : error.message
                }
              }, null, 2)
            }
          ]
        };
      }
    }
    
    case 'execute_command': {
      const command = args?.command as string;
      const cwd = args?.cwd as string | undefined;
      const timeout = args?.timeout as number | undefined || 30000;
      
      if (!command) {
        throw new Error('Command is required');
      }
      
      // Log the incoming request
      console.error(`[execute_command] Request received:`, {
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
        console.error(`[execute_command] Command executed successfully in ${executionTime}ms:`, {
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
        console.error(`[execute_command] Response sent for command: ${command}`);
        
        return response;
      } catch (error: any) {
        const errorMessage = error.stderr || error.message || 'Command execution failed';
        const exitCode = error.status !== undefined ? error.status : 'unknown';
        
        // Log the error
        console.error(`[execute_command] Command failed:`, {
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
        console.error(`[execute_command] Error response sent for command: ${command}`);
        
        return response;
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
              port: process.env.PORT || '3000',
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
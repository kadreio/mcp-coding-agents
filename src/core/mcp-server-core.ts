import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  ListPromptsRequest,
  GetPromptRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { getClaudeCodeToolDefinition, handleClaudeCodeQuery, isClaudeCodeQueryArgs } from '../lib/agents/claude';
import { getGeminiToolDefinition, handleGeminiQuery, isGeminiQueryArgs } from '../lib/agents/gemini';
import { getCodexToolDefinition, handleCodexQuery, isCodexQueryArgs } from '../lib/agents/codex';
import * as promptsData from '../lib/prompts.json';

export interface CoreMCPServerConfig {
  name?: string;
  version?: string;
}

interface ResolvedServerConfig {
  name: string;
  version: string;
}

export interface MCPRequestContext {
  sendNotification?: (notification: any) => Promise<void>;
  signal?: AbortSignal;
}

/**
 * Core MCP Server implementation containing all business logic
 * Transport-agnostic design allows for multiple transport implementations
 */
export class CoreMCPServer {
  private server: Server;
  private config: ResolvedServerConfig;

  constructor(config: CoreMCPServerConfig = {}) {
    this.config = {
      name: config.name ?? '@kadreio/mcp-claude-code',
      version: config.version ?? '1.0.0',
    };

    // Initialize the MCP SDK server
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
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

    // Register all handlers
    this.registerHandlers();
  }

  /**
   * Get the underlying MCP SDK server instance
   * Used by transports to connect
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Register all request handlers
   */
  private registerHandlers(): void {
    // Tools
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));

    // Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, this.handleListResources.bind(this));
    this.server.setRequestHandler(ReadResourceRequestSchema, this.handleReadResource.bind(this));

    // Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, this.handleListPrompts.bind(this));
    this.server.setRequestHandler(GetPromptRequestSchema, this.handleGetPrompt.bind(this));
  }

  /**
   * Handle list tools request
   */
  private async handleListTools(_request: ListToolsRequest): Promise<{ tools: any[] }> {
    const tools: any[] = [
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
        description: 'Generate 10 timestamps streaming',
        inputSchema: {
          type: 'object',
          properties: {
            delay: { type: 'number', description: 'Delay between timestamps in milliseconds (default: 1000)' },
          },
        },
      },
    ];

    // Conditionally add Claude Code tool if enabled
    const claudeCodeTool = getClaudeCodeToolDefinition();
    if (claudeCodeTool) {
      tools.push(claudeCodeTool);
    }

    // Add Gemini tool
    const geminiTool = getGeminiToolDefinition();
    tools.push(geminiTool);

    // Add Codex tool
    const codexTool = getCodexToolDefinition();
    tools.push(codexTool);

    return { tools };
  }

  /**
   * Handle call tool request
   */
  private async handleCallTool(request: CallToolRequest, extra?: MCPRequestContext): Promise<any> {
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

          console.log(`[execute_command] Command executed successfully in ${executionTime}ms:`, {
            command,
            outputLength: output.length,
            outputPreview: output.slice(0, 200) + (output.length > 200 ? '...' : '')
          });

          return {
            content: [
              {
                type: 'text',
                text: output || 'Command executed successfully with no output',
              },
            ],
          };
        } catch (error: any) {
          const errorMessage = error.stderr || error.message || 'Command execution failed';
          const exitCode = error.status !== undefined ? error.status : 'unknown';

          console.log(`[execute_command] Command failed:`, {
            command,
            exitCode,
            errorMessage
          });

          return {
            content: [
              {
                type: 'text',
                text: `Command failed with exit code ${exitCode}: ${errorMessage}`,
              },
            ],
          };
        }
      }

      case 'claude_code_query': {
        if (!isClaudeCodeQueryArgs(args)) {
          throw new Error('Invalid arguments for claude_code_query: prompt is required');
        }
        return await handleClaudeCodeQuery(args, extra?.sendNotification, extra?.signal);
      }

      case 'gemini_query': {
        if (!isGeminiQueryArgs(args)) {
          throw new Error('Invalid arguments for gemini_query: prompt is required');
        }
        return await handleGeminiQuery(args, extra?.signal);
      }

      case 'codex_query': {
        if (!isCodexQueryArgs(args)) {
          throw new Error('Invalid arguments for codex_query: prompt is required');
        }
        return await handleCodexQuery(args, extra?.sendNotification, extra?.signal);
      }

      case 'stream_sse_timestamps': {
        const delay = (args?.delay as number) || 1000;
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const sendNotification = extra?.sendNotification;

        // Check if we can stream (requires sendNotification)
        if (sendNotification) {
          console.log('Streaming timestamps via notifications');

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
                text: 'Successfully streamed 10 timestamps',
              },
            ],
          };
        } else {
          console.log('No notification support - returning all timestamps at once');

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
  }

  /**
   * Handle list resources request
   */
  private async handleListResources(_request: ListResourcesRequest): Promise<any> {
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
  }

  /**
   * Handle read resource request
   */
  private async handleReadResource(request: ReadResourceRequest): Promise<any> {
    const { uri } = request.params;

    switch (uri) {
      case 'config://server':
        return {
          contents: [
            {
              uri: 'config://server',
              mimeType: 'application/json',
              text: JSON.stringify({
                name: this.config.name,
                version: this.config.version,
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
  }

  /**
   * Handle list prompts request
   */
  private async handleListPrompts(_request: ListPromptsRequest): Promise<any> {
    const prompts = Object.values(promptsData.prompts).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));

    return { prompts };
  }

  /**
   * Handle get prompt request
   */
  private async handleGetPrompt(request: GetPromptRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    const prompt = promptsData.prompts[name as keyof typeof promptsData.prompts];

    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    // Replace argument placeholders in content
    let content = prompt.content;
    if (args && prompt.arguments) {
      for (const arg of prompt.arguments) {
        const value = args[arg.name] || `<${arg.name}>`;
        content = content.replace(new RegExp(`\\{${arg.name}\\}`, 'g'), value);
      }
    }

    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
  }
}
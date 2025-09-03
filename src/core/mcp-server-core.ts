import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  ListPromptsRequest,
  GetPromptRequest,
  SetLevelRequest,
  LoggingLevel,
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
  private server!: Server; // Use definite assignment assertion since we initialize in constructor
  private config: ResolvedServerConfig;
  private isStdio: boolean;
  private currentLogLevel: LoggingLevel = 'info';

  constructor(config: CoreMCPServerConfig = {}) {
    this.config = {
      name: config.name ?? '@kadreio/mcp-coding-agents',
      version: config.version ?? '1.0.0',
    };
    
    // Check if we're in STDIO mode
    this.isStdio = process.argv.includes('stdio') || 
                   process.argv.includes('--transport') && process.argv[process.argv.indexOf('--transport') + 1] === 'stdio';
                   
    this.initializeServer();
  }


  private initializeServer(): void {
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
    
    // Log server initialization (no sendNotification available during init)
    if (!this.isStdio) {
      console.log('[info] [core-mcp-server]', { 
        message: 'MCP server initialized',
        name: this.config.name,
        version: this.config.version,
        capabilities: ['tools', 'resources', 'prompts', 'logging']
      });
    }
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

    // Logging
    this.server.setRequestHandler(SetLevelRequestSchema, this.handleSetLoggingLevel.bind(this));
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
            timeout: { type: 'number', description: 'Command timeout in milliseconds (optional, default: 0 which means no timeout)' },
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
        const timeout = args?.timeout as number | undefined || 0;

        if (!command) {
          throw new Error('Command is required');
        }

        this.sendLog('debug', 'execute_command', {
          message: 'Request received',
          command,
          cwd: cwd || 'current directory',
          timeout
        }, extra?.sendNotification);

        try {
          const startTime = Date.now();
          const execOptions: any = {
            encoding: 'utf8',
            cwd: cwd || process.cwd(),
            stdio: 'pipe',
          };
          
          // Only set timeout if it's greater than 0
          if (timeout > 0) {
            execOptions.timeout = timeout;
          }
          
          const output = execSync(command, execOptions);

          const executionTime = Date.now() - startTime;

          this.sendLog('info', 'execute_command', {
            message: `Command executed successfully in ${executionTime}ms`,
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

          this.sendLog('error', 'execute_command', {
            message: 'Command failed',
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
        this.sendLog('info', 'claude_code_query', { message: 'Processing Claude Code query', prompt: args.prompt });
        try {
          const result = await handleClaudeCodeQuery(args, extra?.sendNotification, extra?.signal);
          this.sendLog('info', 'claude_code_query', { message: 'Claude Code query completed successfully' });
          return result;
        } catch (error: any) {
          this.sendLog('error', 'claude_code_query', { message: 'Claude Code query failed', error: error.message });
          throw error;
        }
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
          this.sendLog('debug', 'demo_streaming_tool', { message: 'Streaming timestamps via notifications' }, sendNotification);

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

            this.sendLog('debug', 'demo_streaming_tool', { message: `Streamed timestamp ${i}`, timestamp }, sendNotification);

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
          this.sendLog('debug', 'demo_streaming_tool', { message: 'No notification support - returning all timestamps at once' }, extra?.sendNotification);

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
                port: process.env.PORT || '3050',
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

  /**
   * Handle logging/setLevel request
   */
  private async handleSetLoggingLevel(request: SetLevelRequest): Promise<{}> {
    const { level } = request.params;
    
    // Validate the log level
    const validLevels: LoggingLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    
    this.currentLogLevel = level;
    this.sendLog('info', 'core-mcp-server', { message: `Log level set to ${level}` }, undefined);
    
    return {};
  }

  /**
   * Send a log notification if the level is appropriate
   * Note: This requires a context with sendNotification support
   */
  public sendLog(level: LoggingLevel, logger: string, data: any, sendNotification?: (notification: any) => Promise<void>): void {
    const levelPriority: Record<LoggingLevel, number> = {
      debug: 0,
      info: 1,
      notice: 2,
      warning: 3,
      error: 4,
      critical: 5,
      alert: 6,
      emergency: 7,
    };

    // Only send if the message level is >= current log level
    if (levelPriority[level] >= levelPriority[this.currentLogLevel]) {
      // Use console.log if no notification support
      if (!sendNotification) {
        if (!this.isStdio) {
          console.log(`[${level}] [${logger}]`, data);
        }
        return;
      }
      
      // Send via MCP notification
      sendNotification({
        method: 'notifications/message',
        params: {
          level,
          logger,
          data,
        },
      }).catch(err => {
        if (!this.isStdio) {
          console.error('Failed to send log notification:', err);
        }
      });
    }
  }
}
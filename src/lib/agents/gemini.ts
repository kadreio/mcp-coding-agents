import { log, error as logError } from '../../utils/logger';
import { execSync } from 'child_process';

export interface GeminiQueryArgs {
  prompt: string;
  options?: {
    timeout?: number; // Timeout in milliseconds
  };
}

export interface GeminiResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Type guard to check if an object is valid GeminiQueryArgs
 */
export function isGeminiQueryArgs(args: unknown): args is GeminiQueryArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'prompt' in args &&
    typeof (args as any).prompt === 'string'
  );
}

/**
 * Get the tool definition for Gemini query
 */
export function getGeminiToolDefinition() {
  return {
    name: 'gemini_query',
    description: 'Execute a query using the Gemini CLI tool',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Gemini'
        },
        options: {
          type: 'object',
          description: 'Configuration options for Gemini execution',
          properties: {
            timeout: {
              type: 'number',
              description: 'Command timeout in milliseconds (default: 0 which means no timeout)'
            }
          }
        }
      },
      required: ['prompt'],
    },
  };
}

/**
 * Handle Gemini query execution via shell command
 */
export async function handleGeminiQuery(
  args: GeminiQueryArgs,
  signal?: AbortSignal
): Promise<GeminiResult> {
  const { prompt, options = {} } = args;
  const timeout = options.timeout || 0;

  if (!prompt) {
    throw new Error('Prompt is required for Gemini query');
  }

  log(`[gemini_query] Executing query with prompt: ${prompt.substring(0, 100)}...`);

  try {
    // Check if cancelled before execution
    if (signal?.aborted) {
      throw new Error('Query cancelled before execution');
    }

    const startTime = Date.now();
    
    // Execute the gemini command with the prompt
    // Using -p flag to pass the prompt
    const command = `gemini -p -y "${prompt.replace(/"/g, '\\"')}"`;
    
    log(`[gemini_query] Executing command: gemini -p"..."`);
    
    const execOptions: any = {
      encoding: 'utf8',
      stdio: 'pipe'
    };
    
    // Only set timeout if it's greater than 0
    if (timeout > 0) {
      execOptions.timeout = timeout;
    }
    
    const output = execSync(command, execOptions);

    const executionTime = Date.now() - startTime;
    
    // Remove "Loaded cached credentials." from the output
    const cleanOutput = output.replace(/Loaded cached credentials\.\s*/g, '').trim();
    
    log(`[gemini_query] Command executed successfully in ${executionTime}ms`);
    log(`[gemini_query] Output length: ${cleanOutput.length} characters`);

    return {
      content: [
        {
          type: 'text',
          text: cleanOutput || 'No response from Gemini'
        }
      ]
    };
    
  } catch (error: any) {
    const isCancellation = error.name === 'AbortError' || signal?.aborted;
    const isTimeout = error.code === 'ETIMEDOUT';
    
    logError(`[gemini_query] Query ${isCancellation ? 'cancelled' : 'failed'}:`, {
      error: error.message,
      errorName: error.name,
      errorCode: error.code
    });

    let errorMessage: string;
    
    if (isCancellation) {
      errorMessage = 'Gemini query was cancelled';
    } else if (isTimeout) {
      errorMessage = `Gemini query timed out after ${timeout}ms`;
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Gemini command not found. Please ensure gemini CLI is installed and in PATH';
    } else if (error.stderr) {
      errorMessage = `Gemini error: ${error.stderr}`;
    } else {
      errorMessage = `Gemini query failed: ${error.message}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorMessage
        }
      ]
    };
  }
}
import { log, error as logError } from '../../utils/logger';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

export interface CodexQueryArgs {
  prompt: string;
  options?: {
    timeout?: number; // Timeout in milliseconds
  };
}

export interface CodexResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface CodexNotification {
  method: string;
  params: {
    level: string;
    data: string;
  };
}

/**
 * Type guard to check if an object is valid CodexQueryArgs
 */
export function isCodexQueryArgs(args: unknown): args is CodexQueryArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'prompt' in args &&
    typeof (args as any).prompt === 'string'
  );
}

/**
 * Get the tool definition for Codex query
 */
export function getCodexToolDefinition() {
  return {
    name: 'codex_query',
    description: 'Execute a query using the Codex CLI tool with real-time streaming',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Codex'
        },
        options: {
          type: 'object',
          description: 'Configuration options for Codex execution',
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
 * Handle Codex query execution via shell command with streaming
 */
export async function handleCodexQuery(
  args: CodexQueryArgs,
  sendNotification?: (notification: CodexNotification) => Promise<void>,
  signal?: AbortSignal
): Promise<CodexResult> {
  const { prompt, options = {} } = args;
  const timeout = options.timeout || 0;

  if (!prompt) {
    throw new Error('Prompt is required for Codex query');
  }

  const sessionId = randomUUID();
  log(`[codex_query] Starting query session ${sessionId} with prompt: ${prompt.substring(0, 100)}...`);

  return new Promise((resolve, reject) => {
    try {
      // Check if cancelled before execution
      if (signal?.aborted) {
        reject(new Error('Query cancelled before execution'));
        return;
      }

      const startTime = Date.now();
      let agentMessage: string | null = null;
      let buffer = '';
      let messageCount = 0;
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Spawn the codex process
      const codexProcess = spawn('codex', ['exec', '--json', '--full-auto', prompt], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      log(`[codex_query] Spawned codex process with PID: ${codexProcess.pid}`);

      // Set up timeout
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          log(`[codex_query] Timeout reached after ${timeout}ms`);
          codexProcess.kill('SIGTERM');
          reject(new Error(`Codex query timed out after ${timeout}ms`));
        }, timeout);
      }

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          log(`[codex_query] Cancellation requested for session ${sessionId}`);
          codexProcess.kill('SIGTERM');
          if (timeoutHandle) clearTimeout(timeoutHandle);
        });
      }

      // Process stdout data
      codexProcess.stdout.on('data', async (data: Buffer) => {
        buffer += data.toString();
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            messageCount++;

            // Check if this is an agent_message
            if (parsed.msg && parsed.msg.type === 'agent_message') {
              agentMessage = parsed.msg.message;
              log(`[codex_query] Received agent message: ${agentMessage?.substring(0, 100) || agentMessage}...`);
            } else {
              // Send all other messages as notifications
              if (sendNotification) {
                log(`[codex_query] Sending notification for message ${messageCount} (${parsed.msg?.type || 'unknown'})`);
                try {
                  await sendNotification({
                    method: "notifications/message",
                    params: {
                      level: "info",
                      data: JSON.stringify({
                        type: 'codex_message',
                        sessionId,
                        message: parsed,
                        timestamp: new Date().toISOString(),
                        sequence: messageCount
                      })
                    }
                  });
                } catch (error) {
                  logError(`[codex_query] Failed to send notification:`, error);
                }
              }
            }
          } catch (error) {
            logError(`[codex_query] Failed to parse JSON line:`, line, error);
          }
        }
      });

      // Process stderr data
      codexProcess.stderr.on('data', (data: Buffer) => {
        const errorText = data.toString();
        logError(`[codex_query] Stderr: ${errorText}`);
      });

      // Handle process exit
      codexProcess.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        
        const executionTime = Date.now() - startTime;
        log(`[codex_query] Process exited with code ${code} after ${executionTime}ms`);
        log(`[codex_query] Total messages processed: ${messageCount}`);

        if (signal?.aborted) {
          reject(new Error('Codex query was cancelled'));
        } else if (code === 0 || agentMessage) {
          // Success - return the agent message or a default message
          resolve({
            content: [
              {
                type: 'text',
                text: agentMessage || 'Codex completed without an agent message'
              }
            ]
          });
        } else {
          reject(new Error(`Codex process exited with code ${code}`));
        }
      });

      // Handle process errors
      codexProcess.on('error', (error: any) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        
        logError(`[codex_query] Process error:`, error);
        
        if (error.code === 'ENOENT') {
          reject(new Error('Codex command not found. Please ensure codex CLI is installed and in PATH'));
        } else {
          reject(error);
        }
      });

    } catch (error: any) {
      logError(`[codex_query] Unexpected error:`, error);
      reject(error);
    }
  });
}
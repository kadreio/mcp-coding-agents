import { randomUUID } from 'crypto';
import { claudeCodeConfig } from '../../config/claude-code';
import { log, error as logError } from '../../utils/logger';

// Dynamic import for ES module compatibility
let claudeQuery: any;
type SDKMessage = any;

export interface ClaudeCodeQueryOptions {
  cwd?: string;
  maxTurns?: number;
  model?: string;
  appendSystemPrompt?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  maxMessages?: number;
  includeSystemMessages?: boolean;
  sessionId?: string;
  timeout?: number;
}

export interface ClaudeCodeQueryArgs {
  prompt: string;
  options?: ClaudeCodeQueryOptions;
}

/**
 * Type guard to check if an object is valid ClaudeCodeQueryArgs
 */
export function isClaudeCodeQueryArgs(args: unknown): args is ClaudeCodeQueryArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'prompt' in args &&
    typeof (args as any).prompt === 'string'
  );
}

export interface ClaudeCodeNotification {
  method: string;
  params: {
    level: string;
    data: string;
  };
}

export interface ClaudeCodeResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Get the tool definition for Claude Code query
 */
export function getClaudeCodeToolDefinition() {
  if (!claudeCodeConfig.enabled) {
    return null;
  }

  return {
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
              description: `Working directory for Claude Code (default: ${claudeCodeConfig.defaults.cwd})` 
            },
            maxTurns: { 
              type: 'number', 
              description: `Maximum conversation turns${claudeCodeConfig.defaults.maxTurns ? ` (default: ${claudeCodeConfig.defaults.maxTurns})` : ''}` 
            },
            model: { 
              type: 'string', 
              description: `Model to use${claudeCodeConfig.defaults.model ? ` (default: ${claudeCodeConfig.defaults.model})` : ' (e.g., claude-3-opus)'}` 
            },
            appendSystemPrompt: { 
              type: 'string', 
              description: 'Additional system instructions' 
            },
            permissionMode: {
              type: 'string',
              enum: ['default', 'acceptEdits', 'bypassPermissions', 'plan'],
              description: `Permission mode (default: ${claudeCodeConfig.defaults.permissionMode})`
            },
            maxMessages: {
              type: 'number',
              description: `Maximum messages to return in response (default: ${claudeCodeConfig.defaults.maxMessages})`
            },
            includeSystemMessages: {
              type: 'boolean',
              description: `Include system messages in response (default: ${claudeCodeConfig.defaults.includeSystemMessages})`
            },
            sessionId: {
              type: 'string',
              description: 'Session ID from a previous Claude Code query to continue the conversation'
            },
            timeout: {
              type: 'number',
              description: 'Query timeout in milliseconds (default: 0 which means no timeout)'
            }
          }
        }
      },
      required: ['prompt'],
    },
  };
}

/**
 * Handle Claude Code query execution
 */
export async function handleClaudeCodeQuery(
  args: ClaudeCodeQueryArgs,
  sendNotification?: (notification: ClaudeCodeNotification) => Promise<void>,
  signal?: AbortSignal
): Promise<ClaudeCodeResult> {
  // Dynamic import for ES module compatibility
  if (!claudeQuery) {
    const claudeCodeModule = await import('@anthropic-ai/claude-code');
    claudeQuery = claudeCodeModule.query;
  }
  
  // Check if tool is enabled
  if (!claudeCodeConfig.enabled) {
    throw new Error('Claude Code tool is disabled');
  }
  
  const { prompt, options: requestOptions = {} } = args;
  
  if (!prompt) {
    throw new Error('Prompt is required for Claude Code query');
  }
  
  // Merge request options with configured defaults
  const mergedOptions = claudeCodeConfig.mergeOptions(requestOptions);
  
  // Set up query options
  const queryOptions: any = {
    cwd: mergedOptions.cwd,
    permissionMode: mergedOptions.permissionMode,
    maxTurns: mergedOptions.maxTurns,
    model: mergedOptions.model,
    appendSystemPrompt: requestOptions.appendSystemPrompt, // This one doesn't have a default
    // Add AbortController for cancellation support
    abortController: new AbortController()
  };
  
  // Add resume option if sessionId is provided
  if (requestOptions.sessionId) {
    // Clean up sessionId - remove any surrounding quotes
    const cleanSessionId = requestOptions.sessionId.replace(/^["']|["']$/g, '');
    queryOptions.resume = cleanSessionId;
  }
  
  // Response configuration no longer needed since we only return the final result
  
  // Track execution
  const sessionId = requestOptions.sessionId ? requestOptions.sessionId.replace(/^["']|["']$/g, '') : randomUUID();
  const messages: SDKMessage[] = [];
  let sequence = 0;
  
  log(`[claude_code_query] ${requestOptions.sessionId ? 'Resuming' : 'Starting'} query session ${sessionId}:`, {
    prompt: prompt.substring(0, 100) + '...',
    options: queryOptions,
    isResume: !!requestOptions.sessionId
  });
  
  // Handle timeout
  const timeout = requestOptions.timeout || 0;
  let timeoutHandle: NodeJS.Timeout | null = null;
  
  if (timeout > 0) {
    timeoutHandle = setTimeout(() => {
      log(`[claude_code_query] Timeout reached after ${timeout}ms for session ${sessionId}`);
      queryOptions.abortController.abort();
    }, timeout);
  }
  
  // Handle cancellation from MCP client
  if (signal) {
    signal.addEventListener('abort', () => {
      log(`[claude_code_query] Cancellation requested for session ${sessionId}`);
      if (timeoutHandle) clearTimeout(timeoutHandle);
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
        log(`[claude_code_query] Query cancelled for session ${sessionId}`);
        break;
      }
      messages.push(message);
      sequence++;
      
      // Send notification if available
      if (sendNotification) {
        log(`[claude_code_query] Sending notification for message ${sequence}`);
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: JSON.stringify({
                type: 'claude_code_message',
                sessionId,
                message,
                timestamp: new Date().toISOString(),
                sequence
              })
            }
          });
          log(`[claude_code_query] Notification sent successfully`);
        } catch (error) {
          logError(`[claude_code_query] Failed to send notification:`, error);
        }
      } else {
        log(`[claude_code_query] No sendNotification function available - client may not support SSE`);
      }
      
      log(`[claude_code_query] Message ${sequence} (${message.type}):`, {
        sessionId,
        messageType: message.type
      });
    }
    
    // We no longer need to filter or limit messages since we're only returning the final result
    
    // Clear timeout if it was set
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    
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
    
    log(`[claude_code_query] Query completed:`, {
      sessionId,
      totalMessages: messages.length,
      result
    });
    
    // Extract session_id from any message that has it
    let claudeSessionId = null;
    for (const msg of messages) {
      if ('session_id' in msg) {
        claudeSessionId = (msg as any).session_id;
        break;
      }
    }
    
    // Build response object with result and session_id
    const response = {
      result: result?.summary || 'Query completed but no result text was available',
      session_id: claudeSessionId
    };
    
    // If we don't have a result summary, try to get the last assistant message
    if (!result?.summary) {
      const lastAssistantMessage = messages
        .filter(m => m.type === 'assistant')
        .pop();
      
      if (lastAssistantMessage && 'message' in lastAssistantMessage) {
        const assistantMsg = lastAssistantMessage.message as any;
        const textContent = assistantMsg.content?.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          response.result = textContent.text;
        }
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response)
        }
      ]
    };
    
  } catch (error: any) {
    // Clear timeout if it was set
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    
    const isCancellation = error.name === 'AbortError' || signal?.aborted;
    const isTimeout = isCancellation && timeout > 0 && !signal?.aborted;
    
    logError(`[claude_code_query] Query ${isTimeout ? 'timed out' : isCancellation ? 'cancelled' : 'failed'}:`, {
      sessionId,
      error: error.message,
      errorName: error.name
    });
    
    // Extract session_id from any message that has it
    let claudeSessionId = null;
    for (const msg of messages) {
      if ('session_id' in msg) {
        claudeSessionId = (msg as any).session_id;
        break;
      }
    }
    
    // Return error with session_id
    const errorMessage = isTimeout 
      ? `Query timed out after ${timeout}ms` 
      : isCancellation 
        ? 'Query cancelled by user' 
        : `Query failed: ${error.message}`;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            session_id: claudeSessionId
          })
        }
      ]
    };
  }
}
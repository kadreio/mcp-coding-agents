import { randomUUID } from 'crypto';
import { query as claudeQuery, type SDKMessage } from '@anthropic-ai/claude-code';
import { claudeCodeConfig } from '../../config/claude-code';

export interface ClaudeCodeQueryOptions {
  cwd?: string;
  maxTurns?: number;
  model?: string;
  appendSystemPrompt?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  maxMessages?: number;
  includeSystemMessages?: boolean;
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
  const queryOptions = {
    cwd: mergedOptions.cwd,
    permissionMode: mergedOptions.permissionMode,
    maxTurns: mergedOptions.maxTurns,
    model: mergedOptions.model,
    appendSystemPrompt: requestOptions.appendSystemPrompt, // This one doesn't have a default
    // Add AbortController for cancellation support
    abortController: new AbortController()
  };
  
  // Response configuration
  const maxMessages = mergedOptions.maxMessages;
  const includeSystemMessages = mergedOptions.includeSystemMessages;
  
  // Track execution
  const sessionId = randomUUID();
  const messages: SDKMessage[] = [];
  let sequence = 0;
  const startTime = Date.now();
  
  console.log(`[claude_code_query] Starting query session ${sessionId}:`, {
    prompt: prompt.substring(0, 100) + '...',
    options: queryOptions
  });
  
  // Handle cancellation from MCP client
  if (signal) {
    signal.addEventListener('abort', () => {
      console.log(`[claude_code_query] Cancellation requested for session ${sessionId}`);
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
        console.log(`[claude_code_query] Query cancelled for session ${sessionId}`);
        break;
      }
      messages.push(message);
      sequence++;
      
      // Send notification if available
      if (sendNotification) {
        console.log(`[claude_code_query] Sending notification for message ${sequence}`);
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
          console.log(`[claude_code_query] Notification sent successfully`);
        } catch (error) {
          console.error(`[claude_code_query] Failed to send notification:`, error);
        }
      } else {
        console.log(`[claude_code_query] No sendNotification function available - client may not support SSE`);
      }
      
      console.log(`[claude_code_query] Message ${sequence} (${message.type}):`, {
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
    
    console.log(`[claude_code_query] Query completed:`, {
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
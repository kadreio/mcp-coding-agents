import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ClaudeCodeSessionManager } from './session-manager';
import { handleClaudeCodeQuery } from '../lib/agents/claude';
import { log, error as logError } from '../utils/logger';
import { createAuthMiddleware, createRateLimitMiddleware, AuthConfig, RateLimitConfig } from './auth-middleware';
import { ApiRequest, ApiResponse, ErrorDetails, getErrorMessage } from './types';
import { isCreateSessionRequest, isSendMessageRequest, getValidationError } from './validators';
import { createValidationMiddleware } from '../middleware/swagger-middleware';
import * as path from 'path';

export interface ClaudeCodeApiConfig {
  sessionTimeout?: number; // Session timeout in milliseconds
  maxSessions?: number; // Maximum concurrent sessions
  auth?: AuthConfig; // Authentication configuration
  rateLimit?: RateLimitConfig; // Rate limiting configuration
  openApiValidation?: {
    enabled?: boolean;
    specPath?: string;
  };
}

export interface CreateSessionRequest {
  model?: string;
  cwd?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  appendSystemPrompt?: string;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  prompt: string;
  stream?: boolean;
  timeout?: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  timestamp: string;
  requestId: string;
}

/**
 * Create Claude Code REST API router
 */
export function createClaudeCodeApi(config: ClaudeCodeApiConfig = {}): Router {
  const router = Router();
  const sessionManager = new ClaudeCodeSessionManager(config);

  // Middleware to generate request ID
  router.use((req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    apiReq.requestId = randomUUID();
    res.setHeader('X-Request-ID', apiReq.requestId);
    next();
  });

  // Apply authentication middleware if configured
  if (config.auth?.enabled !== false) {
    router.use(createAuthMiddleware(config.auth || {}));
  }

  // Apply rate limiting middleware if configured
  if (config.rateLimit?.enabled !== false) {
    router.use(createRateLimitMiddleware(config.rateLimit || {}));
  }

  // Apply OpenAPI validation middleware if configured
  if (config.openApiValidation?.enabled) {
    const specPath = config.openApiValidation.specPath || 
      path.join(__dirname, '../../docs/openapi/claude-code-api.yaml');
    router.use(createValidationMiddleware(specPath, {
      validateRequests: true,
      validateResponses: true
    }));
  }

  // Error handler
  const handleError = (res: Response, code: string, message: string, status: number, details?: ErrorDetails) => {
    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        details
      },
      timestamp: new Date().toISOString(),
      requestId: (res as ApiResponse).requestId || 'unknown'
    };
    res.status(status).json(errorResponse);
  };

  /**
   * POST /api/v1/sessions
   * Create a new Claude Code session
   */
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      // Validate request body
      if (!isCreateSessionRequest(req.body)) {
        handleError(res, 'INVALID_REQUEST', getValidationError(req.body, 'CreateSessionRequest'), 400);
        return;
      }
      const body = req.body;
      
      // Create session with configuration
      const session = sessionManager.createSession({
        model: body.model,
        cwd: body.cwd,
        permissionMode: body.permissionMode,
        appendSystemPrompt: body.appendSystemPrompt,
        maxTurns: body.maxTurns,
        metadata: body.metadata
      });

      log('[claude-api] Session created:', {
        sessionId: session.sessionId,
        config: session.config
      });

      res.status(201).json({
        sessionId: session.sessionId,
        model: session.config.model,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      logError('[claude-api] Failed to create session:', error);
      if (getErrorMessage(error).includes('Maximum sessions')) {
        handleError(res, 'MAX_SESSIONS_REACHED', getErrorMessage(error), 429);
      } else {
        handleError(res, 'SESSION_CREATE_FAILED', getErrorMessage(error), 500);
      }
    }
  });

  /**
   * GET /api/v1/sessions
   * List active sessions
   */
  router.get('/sessions', async (_req: Request, res: Response) => {
    try {
      const sessions = sessionManager.listSessions();
      
      res.json({
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          model: s.config.model,
          status: s.status,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          metadata: s.config.metadata
        })),
        total: sessions.length
      });
    } catch (error) {
      logError('[claude-api] Failed to list sessions:', error);
      handleError(res, 'LIST_SESSIONS_FAILED', getErrorMessage(error), 500);
    }
  });

  /**
   * GET /api/v1/sessions/:id
   * Get session details
   */
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      
      if (!session) {
        handleError(res, 'SESSION_NOT_FOUND', `Session ${req.params.id} not found`, 404);
        return;
      }

      res.json({
        sessionId: session.sessionId,
        model: session.config.model,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        config: {
          cwd: session.config.cwd,
          permissionMode: session.config.permissionMode,
          maxTurns: session.config.maxTurns
        },
        metadata: session.config.metadata
      });
    } catch (error) {
      logError('[claude-api] Failed to get session:', error);
      handleError(res, 'GET_SESSION_FAILED', getErrorMessage(error), 500);
    }
  });

  /**
   * DELETE /api/v1/sessions/:id
   * End a session
   */
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const success = sessionManager.endSession(req.params.id);
      
      if (!success) {
        handleError(res, 'SESSION_NOT_FOUND', `Session ${req.params.id} not found`, 404);
        return;
      }

      res.status(204).send();
    } catch (error) {
      logError('[claude-api] Failed to end session:', error);
      handleError(res, 'END_SESSION_FAILED', getErrorMessage(error), 500);
    }
  });

  /**
   * POST /api/v1/sessions/:id/messages
   * Send a message to a session
   */
  router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      
      if (!session) {
        handleError(res, 'SESSION_NOT_FOUND', `Session ${req.params.id} not found`, 404);
        return;
      }

      // Validate request body
      if (!isSendMessageRequest(req.body)) {
        handleError(res, 'INVALID_REQUEST', getValidationError(req.body, 'SendMessageRequest'), 400);
        return;
      }
      const body = req.body;

      // Update session activity
      sessionManager.updateActivity(req.params.id);

      // Check if streaming is requested
      if (body.stream) {
        // Return streaming endpoint information
        res.json({ 
          message: 'Use SSE endpoint for streaming responses',
          streamUrl: `/api/v1/sessions/${req.params.id}/stream`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: {
            prompt: body.prompt,
            timeout: body.timeout
          }
        });
        return;
      }

      // Non-streaming request
      const args = {
        prompt: body.prompt,
        options: {
          ...session.config,
          sessionId: session.claudeSessionId,
          timeout: body.timeout
        }
      };

      // For non-streaming requests, we don't need abort handling
      // since the response is sent all at once
      const result = await handleClaudeCodeQuery(args);
      
      // Parse the result to extract session ID
      let responseData;
      try {
        responseData = JSON.parse(result.content[0].text);
        // Update Claude session ID if provided
        if (responseData.session_id) {
          sessionManager.updateClaudeSessionId(req.params.id, responseData.session_id);
        }
      } catch (e) {
        responseData = { result: result.content[0].text };
      }

      res.json({
        messageId: randomUUID(),
        response: responseData.result || responseData,
        sessionId: responseData.session_id
      });

    } catch (error) {
      logError('[claude-api] Failed to send message:', error);
      if (getErrorMessage(error).includes('timeout')) {
        handleError(res, 'REQUEST_TIMEOUT', getErrorMessage(error), 408);
      } else {
        handleError(res, 'MESSAGE_SEND_FAILED', getErrorMessage(error), 500);
      }
    }
  });

  /**
   * POST /api/v1/sessions/:id/stream
   * SSE endpoint for streaming messages
   */
  router.post('/sessions/:id/stream', async (req: Request, res: Response) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      
      if (!session) {
        handleError(res, 'SESSION_NOT_FOUND', `Session ${req.params.id} not found`, 404);
        return;
      }

      // Validate request body
      if (!isSendMessageRequest(req.body)) {
        handleError(res, 'INVALID_REQUEST', getValidationError(req.body, 'SendMessageRequest'), 400);
        return;
      }
      const { prompt, timeout } = req.body;

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

      // Send initial connection event
      res.write(`event: connected\ndata: ${JSON.stringify({ sessionId: req.params.id })}\n\n`);
      
      // Flush the response to ensure client receives the connection event
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 30000);

      // Handle client disconnect
      const abortController = new AbortController();
      
      let queryStarted = false;
      let queryCompleted = false;
      
      // Use 'error' and 'aborted' events for better disconnect detection
      const handleDisconnect = () => {
        if (!queryCompleted) {
          clearInterval(keepAlive);
          // Only abort if the query has started but hasn't completed yet
          if (queryStarted && !res.writableEnded) {
            abortController.abort();
            log('[claude-api] SSE client disconnected during query, aborting:', req.params.id);
          } else if (!queryStarted) {
            log('[claude-api] SSE client disconnected before query started:', req.params.id);
          }
        }
      };
      
      req.on('close', handleDisconnect);
      req.on('error', (err) => {
        log('[claude-api] SSE client error:', err.message);
        handleDisconnect();
      });
      
      // Also check if response is closed
      res.on('close', () => {
        if (!queryCompleted) {
          log('[claude-api] SSE response closed unexpectedly');
          handleDisconnect();
        }
      });

      // Update session activity
      sessionManager.updateActivity(req.params.id);

      // Create notification handler for SSE
      const sendNotification = async (notification: any) => {
        try {
          // Parse the Claude Code notification
          const data = typeof notification.params.data === 'string' 
            ? JSON.parse(notification.params.data)
            : notification.params.data;
          
          // Send as SSE event
          res.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          logError('[claude-api] Failed to send SSE notification:', error);
        }
      };

      // Execute Claude Code query with streaming
      const args = {
        prompt,
        options: {
          ...session.config,
          sessionId: session.claudeSessionId,
          timeout: timeout || 0,
          abortController: abortController
        }
      };

      log('[claude-api] Starting streaming query:', {
        sessionId: req.params.id,
        claudeSessionId: session.claudeSessionId,
        prompt: prompt.substring(0, 100) + '...',
        timeout: timeout || 0
      });

      // Small delay to ensure SSE connection is stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        queryStarted = true;
        const result = await handleClaudeCodeQuery(args, sendNotification, abortController.signal);
        
        // Parse final result
        let responseData;
        try {
          responseData = JSON.parse(result.content[0].text);
          // Update Claude session ID if provided
          if (responseData.session_id) {
            sessionManager.updateClaudeSessionId(req.params.id, responseData.session_id);
          }
        } catch (e) {
          responseData = { result: result.content[0].text };
        }

        // Send completion event
        res.write(`event: complete\ndata: ${JSON.stringify({
          summary: responseData.result || responseData,
          sessionId: responseData.session_id
        })}\n\n`);

        // Mark query as completed
        queryCompleted = true;
        
        // Clean up
        clearInterval(keepAlive);
        res.end();

      } catch (error) {
        // Mark query as completed (even if failed)
        queryCompleted = true;
        
        // Send error event
        res.write(`event: error\ndata: ${JSON.stringify({
          error: getErrorMessage(error)
        })}\n\n`);

        clearInterval(keepAlive);
        res.end();
      }

    } catch (error) {
      logError('[claude-api] Failed to setup SSE:', error);
      handleError(res, 'SSE_SETUP_FAILED', getErrorMessage(error), 500);
    }
  });

  /**
   * GET /api/v1/models
   * List available models
   */
  router.get('/models', async (_req: Request, res: Response) => {
    res.json({
      models: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ]
    });
  });

  /**
   * GET /api/v1/health
   * Health check
   */
  router.get('/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        active: sessionManager.getActiveSessionCount(),
        total: sessionManager.getTotalSessionCount()
      }
    });
  });

  return router;
}
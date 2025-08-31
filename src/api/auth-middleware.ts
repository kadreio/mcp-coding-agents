import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

export interface AuthConfig {
  enabled?: boolean;
  apiKeyHeader?: string;
  apiKeys?: string[];
  requireAuth?: string[]; // Endpoints that require auth
}

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  requestId?: string;
}

/**
 * Create authentication middleware for API key validation
 */
export function createAuthMiddleware(config: AuthConfig = {}) {
  const authConfig = {
    enabled: config.enabled !== false,
    apiKeyHeader: config.apiKeyHeader || 'x-api-key',
    apiKeys: config.apiKeys || getApiKeysFromEnv(),
    requireAuth: config.requireAuth || [
      'POST /sessions',
      'POST /sessions/:id/messages',
      'DELETE /sessions/:id'
    ]
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip auth if disabled
    if (!authConfig.enabled) {
      return next();
    }

    // Skip auth for endpoints that don't require it
    const requiresAuth = authConfig.requireAuth.some(pattern => {
      const regex = pattern.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${regex}$`).test(`${req.method} ${req.path}`);
    });

    if (!requiresAuth) {
      return next();
    }

    // Extract API key from header
    const apiKey = req.headers[authConfig.apiKeyHeader.toLowerCase()] as string;

    if (!apiKey) {
      log('[auth] Request missing API key:', {
        path: req.path,
        method: req.method,
        headers: Object.keys(req.headers)
      });

      return res.status(401).json({
        error: {
          code: 'MISSING_API_KEY',
          message: `Missing ${authConfig.apiKeyHeader} header`
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }

    // Validate API key
    if (!authConfig.apiKeys.includes(apiKey)) {
      log('[auth] Invalid API key:', {
        path: req.path,
        method: req.method,
        apiKey: apiKey.substring(0, 8) + '...'
      });

      return res.status(403).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }

    // Attach API key to request for logging/tracking
    req.apiKey = apiKey;
    
    log('[auth] Request authenticated:', {
      path: req.path,
      method: req.method,
      apiKey: apiKey.substring(0, 8) + '...'
    });

    next();
  };
}

/**
 * Get API keys from environment variables
 */
function getApiKeysFromEnv(): string[] {
  const keys: string[] = [];
  
  // Single key
  if (process.env.CLAUDE_API_KEY) {
    keys.push(process.env.CLAUDE_API_KEY);
  }
  
  // Multiple keys (comma-separated)
  if (process.env.CLAUDE_API_KEYS) {
    keys.push(...process.env.CLAUDE_API_KEYS.split(',').map(k => k.trim()));
  }
  
  // Numbered keys (CLAUDE_API_KEY_1, CLAUDE_API_KEY_2, etc.)
  let i = 1;
  while (process.env[`CLAUDE_API_KEY_${i}`]) {
    keys.push(process.env[`CLAUDE_API_KEY_${i}`]!);
    i++;
  }
  
  return keys;
}

/**
 * Create rate limiting middleware
 */
export interface RateLimitConfig {
  enabled?: boolean;
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
}

interface RateLimitStore {
  requests: number;
  resetTime: number;
}

export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  const rateLimitConfig = {
    enabled: config.enabled !== false,
    windowMs: config.windowMs || 3600000, // 1 hour default
    maxRequests: config.maxRequests || 100,
    keyGenerator: config.keyGenerator || ((req: AuthenticatedRequest) => req.apiKey || req.ip || 'unknown')
  };

  // In-memory store for rate limits
  const store = new Map<string, RateLimitStore>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      if (data.resetTime < now) {
        store.delete(key);
      }
    }
  }, rateLimitConfig.windowMs);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!rateLimitConfig.enabled) {
      return next();
    }

    const key = rateLimitConfig.keyGenerator(req);
    const now = Date.now();
    
    let limitData = store.get(key);
    
    // Initialize or reset if window expired
    if (!limitData || limitData.resetTime < now) {
      limitData = {
        requests: 0,
        resetTime: now + rateLimitConfig.windowMs
      };
      store.set(key, limitData);
    }

    limitData.requests++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitConfig.maxRequests - limitData.requests).toString());
    res.setHeader('X-RateLimit-Reset', limitData.resetTime.toString());

    // Check if limit exceeded
    if (limitData.requests > rateLimitConfig.maxRequests) {
      log('[rate-limit] Limit exceeded:', {
        key,
        requests: limitData.requests,
        limit: rateLimitConfig.maxRequests
      });

      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: {
            limit: rateLimitConfig.maxRequests,
            window: rateLimitConfig.windowMs,
            reset: new Date(limitData.resetTime).toISOString()
          }
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }

    next();
  };
}
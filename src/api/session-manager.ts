import { randomUUID } from 'crypto';
import { log } from '../utils/logger';

export interface SessionConfig {
  model?: string;
  cwd?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  appendSystemPrompt?: string;
  maxTurns?: number;
  metadata?: Record<string, any>;
}

export interface Session {
  sessionId: string;
  claudeSessionId?: string;
  config: SessionConfig;
  status: 'active' | 'expired' | 'ended';
  createdAt: string;
  expiresAt: string;
  lastActivity: string;
  messageCount: number;
}

interface SessionManagerConfig {
  sessionTimeout?: number; // Default: 1 hour
  maxSessions?: number; // Default: 100
}

/**
 * Manages Claude Code sessions with TTL and cleanup
 */
export class ClaudeCodeSessionManager {
  private sessions: Map<string, Session>;
  private config: Required<SessionManagerConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private totalSessionsCreated: number = 0;

  constructor(config: SessionManagerConfig = {}) {
    this.sessions = new Map();
    this.config = {
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour default
      maxSessions: config.maxSessions || 100
    };

    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Create a new session
   */
  createSession(config: SessionConfig): Session {
    // Check max sessions limit
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Maximum sessions limit reached: ${this.config.maxSessions}`);
    }

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeout);

    const session: Session = {
      sessionId,
      config: {
        model: config.model, // Don't set default, let SDK choose
        cwd: config.cwd || process.cwd(),
        permissionMode: config.permissionMode || 'default',
        appendSystemPrompt: config.appendSystemPrompt,
        maxTurns: config.maxTurns || 10,
        metadata: config.metadata || {}
      },
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivity: now.toISOString(),
      messageCount: 0
    };

    this.sessions.set(sessionId, session);
    this.totalSessionsCreated++;

    log('[session-manager] Session created:', {
      sessionId,
      totalActive: this.sessions.size,
      totalCreated: this.totalSessionsCreated
    });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
      return session;
    }

    return session;
  }

  /**
   * List all active sessions
   */
  listSessions(): Session[] {
    const activeSessions: Session[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.status === 'active' && new Date(session.expiresAt) >= new Date()) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session && session.status === 'active') {
      session.lastActivity = new Date().toISOString();
      session.messageCount++;
      
      // Extend expiration
      const newExpiry = new Date(Date.now() + this.config.sessionTimeout);
      session.expiresAt = newExpiry.toISOString();
    }
  }

  /**
   * Update Claude session ID after first interaction
   */
  updateClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.claudeSessionId = claudeSessionId;
      log('[session-manager] Updated Claude session ID:', {
        sessionId,
        claudeSessionId
      });
    }
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    session.status = 'ended';
    this.sessions.delete(sessionId);

    log('[session-manager] Session ended:', {
      sessionId,
      duration: Date.now() - new Date(session.createdAt).getTime(),
      messageCount: session.messageCount
    });

    return true;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    let count = 0;
    const now = new Date();

    for (const session of this.sessions.values()) {
      if (session.status === 'active' && new Date(session.expiresAt) >= now) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get total sessions created
   */
  getTotalSessionCount(): number {
    return this.totalSessionsCreated;
  }

  /**
   * Start background cleanup task
   */
  private startCleanupTask(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);

    log('[session-manager] Cleanup task started');
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log('[session-manager] Cleaned up expired sessions:', {
        cleaned,
        remaining: this.sessions.size
      });
    }
  }

  /**
   * Stop cleanup task (for graceful shutdown)
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      log('[session-manager] Cleanup task stopped');
    }
  }

  /**
   * Get session statistics
   */
  getStatistics(): Record<string, any> {
    const stats = {
      totalCreated: this.totalSessionsCreated,
      activeCount: this.getActiveSessionCount(),
      totalInMemory: this.sessions.size,
      sessionsByStatus: {
        active: 0,
        expired: 0,
        ended: 0
      }
    };

    for (const session of this.sessions.values()) {
      stats.sessionsByStatus[session.status]++;
    }

    return stats;
  }
}
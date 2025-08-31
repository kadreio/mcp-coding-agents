import { randomUUID } from 'crypto';
import { log } from '../utils/logger';
import { SessionConfig, Session } from './session-manager';
import { SQLiteSessionStore, SessionStore, MessageRecord } from './sqlite-session-store';

interface SessionManagerConfig {
  sessionTimeout?: number; // Default: 1 hour
  maxSessions?: number; // Default: 100
  dbPath?: string; // Database file path
}

/**
 * SQLite-backed Claude Code session manager with persistent storage
 */
export class ClaudeCodeSessionManager {
  private store: SessionStore;
  private config: Required<SessionManagerConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private totalSessionsCreated: number = 0;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour default
      maxSessions: config.maxSessions || 100,
      dbPath: config.dbPath || './data/sessions.db'
    };

    // Initialize SQLite store
    this.store = new SQLiteSessionStore(this.config.dbPath);
    
    // Load total sessions count from database
    this.totalSessionsCreated = this.store.listSessions().length;

    // Start cleanup task
    this.startCleanupTask();
    
    log('[session-manager] SQLite session manager initialized:', {
      dbPath: this.config.dbPath,
      existingSessions: this.totalSessionsCreated
    });
  }

  /**
   * Create a new session
   */
  createSession(config: SessionConfig): Session {
    // Check max sessions limit
    const activeSessions = this.store.listSessions('active');
    if (activeSessions.length >= this.config.maxSessions) {
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

    this.store.createSession(sessionId, session);
    this.totalSessionsCreated++;

    log('[session-manager] Session created:', {
      sessionId,
      totalActive: activeSessions.length + 1,
      totalCreated: this.totalSessionsCreated
    });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const session = this.store.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
      this.store.updateSession(sessionId, { status: 'expired' });
      return session;
    }

    return session;
  }

  /**
   * List all active sessions
   */
  listSessions(): Session[] {
    const sessions = this.store.listSessions('active');
    const now = new Date();
    
    // Filter out expired sessions
    return sessions.filter(session => new Date(session.expiresAt) >= now);
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.store.getSession(sessionId);
    
    if (session && session.status === 'active') {
      const now = new Date();
      const newExpiry = new Date(now.getTime() + this.config.sessionTimeout);
      
      this.store.updateSession(sessionId, {
        lastActivity: now.toISOString(),
        expiresAt: newExpiry.toISOString(),
        messageCount: session.messageCount + 1
      });
    }
  }

  /**
   * Update Claude session ID after first interaction
   */
  updateClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    const session = this.store.getSession(sessionId);
    
    if (session) {
      this.store.updateSession(sessionId, { claudeSessionId });
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
    const session = this.store.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    this.store.updateSession(sessionId, { status: 'ended' });

    log('[session-manager] Session ended:', {
      sessionId,
      duration: Date.now() - new Date(session.createdAt).getTime(),
      messageCount: session.messageCount
    });

    return true;
  }

  /**
   * Save a message from Claude SDK
   */
  saveMessage(sessionId: string, message: any, sequence: number, source?: 'user' | 'sdk'): void {
    this.store.saveMessage(sessionId, message, sequence, source);
  }

  /**
   * Get message history for a session
   */
  getMessages(sessionId: string, limit?: number, offset?: number): MessageRecord[] {
    return this.store.getMessages(sessionId, limit, offset);
  }

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId: string): number {
    return this.store.getMessageCount(sessionId);
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.listSessions().length;
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
    const cleaned = this.store.cleanupExpiredSessions(now);

    if (cleaned > 0) {
      log('[session-manager] Cleaned up expired sessions:', {
        cleaned,
        remaining: this.getActiveSessionCount()
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
    
    // Close database connection
    this.store.close();
  }

  /**
   * Get session statistics
   */
  getStatistics(): Record<string, any> {
    const allSessions = this.store.listSessions();
    const stats = {
      totalCreated: this.totalSessionsCreated,
      activeCount: this.getActiveSessionCount(),
      totalInDatabase: allSessions.length,
      sessionsByStatus: {
        active: 0,
        expired: 0,
        ended: 0
      }
    };

    for (const session of allSessions) {
      stats.sessionsByStatus[session.status]++;
    }

    return stats;
  }
}
import Database from 'better-sqlite3';
import { Session } from './session-manager';
import { log, error as logError } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import envPaths from 'env-paths';

export interface MessageRecord {
  id: number;
  sessionId: string;
  messageType: string;
  messageSubtype?: string;
  content: string;
  sequence: number;
  timestamp: string;
  metadata?: string;
  source: 'user' | 'sdk';
}

export interface SessionStore {
  createSession(sessionId: string, session: Session): void;
  getSession(sessionId: string): Session | null;
  updateSession(sessionId: string, updates: Partial<Session>): void;
  deleteSession(sessionId: string): void;
  listSessions(status?: 'active' | 'expired' | 'ended'): Session[];
  
  // Message storage
  saveMessage(sessionId: string, message: any, sequence: number, source?: 'user' | 'sdk'): void;
  getMessages(sessionId: string, limit?: number, offset?: number): MessageRecord[];
  getMessageCount(sessionId: string): number;
  
  // Maintenance
  cleanupExpiredSessions(before: Date): number;
  close(): void;
}

export class SQLiteSessionStore implements SessionStore {
  private db: Database.Database;
  
  constructor(dbPath?: string) {
    // Use provided path, env variable, or default to user data directory
    const finalPath = dbPath || process.env.MCP_DATABASE_PATH || this.getDefaultDbPath();
    
    // Ensure directory exists
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    try {
      this.db = new Database(finalPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      
      this.initializeSchema();
      this.runMigrations();
      log('[sqlite-store] Database initialized at:', finalPath);
    } catch (error) {
      logError('[sqlite-store] Failed to initialize database:', error);
      logError('[sqlite-store] Path:', finalPath);
      logError('[sqlite-store] If you see permission errors, try setting MCP_DATABASE_PATH environment variable');
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private getDefaultDbPath(): string {
    const paths = envPaths('mcp-coding-agents', { suffix: '' });
    return path.join(paths.data, 'sessions.db');
  }
  
  private initializeSchema(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        claudeSessionId TEXT,
        config TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'ended')),
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        lastActivity TEXT NOT NULL,
        messageCount INTEGER DEFAULT 0,
        UNIQUE(sessionId)
      )
    `);
    
    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        messageType TEXT NOT NULL,
        messageSubtype TEXT,
        content TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        source TEXT NOT NULL DEFAULT 'sdk',
        FOREIGN KEY (sessionId) REFERENCES sessions(sessionId) ON DELETE CASCADE
      )
    `);
    
    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId);
      CREATE INDEX IF NOT EXISTS idx_messages_sequence ON messages(sessionId, sequence);
    `);
  }
  
  private runMigrations(): void {
    // Check if source column exists
    const columns = this.db.pragma('table_info(messages)') as Array<{name: string}>;
    const hasSourceColumn = columns.some((col) => col.name === 'source');
    
    if (!hasSourceColumn) {
      log('[sqlite-store] Running migration: Adding source column to messages table');
      this.db.exec(`
        ALTER TABLE messages ADD COLUMN source TEXT NOT NULL DEFAULT 'sdk';
      `);
      log('[sqlite-store] Migration completed: source column added');
    }
  }
  
  createSession(sessionId: string, session: Session): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (sessionId, claudeSessionId, config, status, createdAt, expiresAt, lastActivity, messageCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        sessionId,
        session.claudeSessionId || null,
        JSON.stringify(session.config),
        session.status,
        session.createdAt,
        session.expiresAt,
        session.lastActivity,
        session.messageCount
      );
    } catch (error) {
      logError('[sqlite-store] Failed to create session:', error);
      throw error;
    }
  }
  
  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE sessionId = ?
    `);
    
    const row = stmt.get(sessionId) as any;
    if (!row) return null;
    
    return {
      sessionId: row.sessionId,
      claudeSessionId: row.claudeSessionId,
      config: JSON.parse(row.config),
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActivity: row.lastActivity,
      messageCount: row.messageCount
    };
  }
  
  updateSession(sessionId: string, updates: Partial<Session>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.claudeSessionId !== undefined) {
      fields.push('claudeSessionId = ?');
      values.push(updates.claudeSessionId);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.lastActivity !== undefined) {
      fields.push('lastActivity = ?');
      values.push(updates.lastActivity);
    }
    if (updates.expiresAt !== undefined) {
      fields.push('expiresAt = ?');
      values.push(updates.expiresAt);
    }
    if (updates.messageCount !== undefined) {
      fields.push('messageCount = ?');
      values.push(updates.messageCount);
    }
    
    if (fields.length === 0) return;
    
    values.push(sessionId);
    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields.join(', ')} WHERE sessionId = ?
    `);
    
    stmt.run(...values);
  }
  
  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE sessionId = ?');
    stmt.run(sessionId);
  }
  
  listSessions(status?: 'active' | 'expired' | 'ended'): Session[] {
    let query = 'SELECT * FROM sessions';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY lastActivity DESC';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      sessionId: row.sessionId,
      claudeSessionId: row.claudeSessionId,
      config: JSON.parse(row.config),
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActivity: row.lastActivity,
      messageCount: row.messageCount
    }));
  }
  
  saveMessage(sessionId: string, message: any, sequence: number, source: 'user' | 'sdk' = 'sdk'): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (sessionId, messageType, messageSubtype, content, sequence, metadata, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Extract message type and subtype
    const messageType = message.type;
    const messageSubtype = message.subtype || null;
    
    // Store the full message content as JSON
    const content = JSON.stringify(message);
    
    // Extract any metadata we want to store separately for querying
    const metadata = message.type === 'result' ? JSON.stringify({
      duration_ms: message.duration_ms,
      total_cost_usd: message.total_cost_usd,
      num_turns: message.num_turns
    }) : null;
    
    try {
      stmt.run(sessionId, messageType, messageSubtype, content, sequence, metadata, source);
    } catch (error) {
      logError('[sqlite-store] Failed to save message:', error);
      // Don't throw - we don't want message storage failure to break the query
    }
  }
  
  getMessages(sessionId: string, limit: number = 100, offset: number = 0): MessageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE sessionId = ? 
      ORDER BY sequence ASC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(sessionId, limit, offset) as any[];
    
    return rows.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      messageType: row.messageType,
      messageSubtype: row.messageSubtype,
      content: row.content,
      sequence: row.sequence,
      timestamp: row.timestamp,
      metadata: row.metadata,
      source: row.source || 'sdk'
    }));
  }
  
  getMessageCount(sessionId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE sessionId = ?');
    const result = stmt.get(sessionId) as any;
    return result.count;
  }
  
  cleanupExpiredSessions(before: Date): number {
    const stmt = this.db.prepare(`
      DELETE FROM sessions 
      WHERE expiresAt < ? AND status != 'ended'
    `);
    
    const result = stmt.run(before.toISOString());
    return result.changes;
  }
  
  close(): void {
    this.db.close();
  }
}
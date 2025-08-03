import { CoreMCPServer } from './mcp-server-core';

/**
 * Transport configuration options
 */
export interface TransportConfig {
  // Common configuration options
  [key: string]: any;
}

/**
 * Abstract transport interface that all transport implementations must follow
 */
export abstract class MCPTransport {
  protected coreServer: CoreMCPServer;
  protected config: TransportConfig;

  constructor(coreServer: CoreMCPServer, config: TransportConfig = {}) {
    this.coreServer = coreServer;
    this.config = config;
  }

  /**
   * Initialize the transport
   */
  abstract initialize(): Promise<void>;

  /**
   * Start the transport and begin listening for requests
   */
  abstract start(): Promise<void>;

  /**
   * Stop the transport and clean up resources
   */
  abstract stop(): Promise<void>;

  /**
   * Get transport type identifier
   */
  abstract getType(): string;

  /**
   * Check if transport is currently running
   */
  abstract isRunning(): boolean;
}
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPTransport, TransportConfig } from '../core/transport-interface';
import { CoreMCPServer } from '../core/mcp-server-core';

export interface StdioTransportConfig extends TransportConfig {
  // STDIO-specific configuration if needed
}

/**
 * STDIO Transport implementation for MCP Server
 * Uses standard input/output for communication
 */
export class StdioTransport extends MCPTransport {
  private transport: StdioServerTransport | null = null;
  private running: boolean = false;

  constructor(coreServer: CoreMCPServer, config: StdioTransportConfig = {}) {
    super(coreServer, config);
  }

  async initialize(): Promise<void> {
    // Create STDIO transport
    this.transport = new StdioServerTransport();
    
    // Connect the transport to the core MCP server
    const mcpServer = this.coreServer.getServer();
    await mcpServer.connect(this.transport);
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('STDIO transport is already running');
    }

    if (!this.transport) {
      throw new Error('Transport not initialized. Call initialize() first.');
    }

    console.error('🚀 MCP STDIO Server started');
    console.error('📡 Listening on stdin/stdout for JSON-RPC messages');
    console.error('💡 Use Ctrl+D (Unix) or Ctrl+Z (Windows) to exit');
    
    this.running = true;

    // The STDIO transport automatically starts listening when connected
    // We just need to keep the process alive and handle shutdown
    process.on('SIGINT', () => this.handleShutdown());
    process.on('SIGTERM', () => this.handleShutdown());
    
    // Keep the process running
    await new Promise(() => {
      // This promise never resolves naturally - the process will be terminated by signals
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.error('\n🛑 Shutting down STDIO transport...');
    
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.running = false;
    console.error('✅ STDIO transport stopped');
  }

  private async handleShutdown(): Promise<void> {
    await this.stop();
    process.exit(0);
  }

  getType(): string {
    return 'stdio';
  }

  isRunning(): boolean {
    return this.running;
  }
}
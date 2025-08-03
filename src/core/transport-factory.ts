import { CoreMCPServer } from './mcp-server-core';
import { MCPTransport } from './transport-interface';
import { HttpTransport, HttpTransportConfig } from '../transports/http-transport';
import { StdioTransport, StdioTransportConfig } from '../transports/stdio-transport';

export type TransportType = 'stdio' | 'http';

export interface TransportFactoryConfig {
  type: TransportType;
  config?: HttpTransportConfig | StdioTransportConfig;
}

/**
 * Factory for creating transport instances
 */
export class TransportFactory {
  /**
   * Create a transport instance based on the specified type
   */
  static async createTransport(
    coreServer: CoreMCPServer,
    options: TransportFactoryConfig
  ): Promise<MCPTransport> {
    let transport: MCPTransport;

    switch (options.type) {
      case 'stdio':
        transport = new StdioTransport(coreServer, options.config || {});
        break;
      
      case 'http':
        transport = new HttpTransport(coreServer, options.config as HttpTransportConfig || {});
        break;
      
      default:
        throw new Error(`Unknown transport type: ${options.type}`);
    }

    // Initialize the transport
    await transport.initialize();
    
    return transport;
  }
}
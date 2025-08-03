import { CoreMCPServer } from '../../../src/core/mcp-server-core';
import { TransportFactory } from '../../../src/core/transport-factory';
import { HttpTransport } from '../../../src/transports/http-transport';
import { StdioTransport } from '../../../src/transports/stdio-transport';

describe('TransportFactory', () => {
  let coreServer: CoreMCPServer;

  beforeEach(() => {
    coreServer = new CoreMCPServer({
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('createTransport', () => {
    test('should create HTTP transport when type is http', async () => {
      const transport = await TransportFactory.createTransport(coreServer, {
        type: 'http',
        config: { port: 3050 }
      });

      expect(transport).toBeInstanceOf(HttpTransport);
      expect(transport.getType()).toBe('http');
    });

    test('should create STDIO transport when type is stdio', async () => {
      const transport = await TransportFactory.createTransport(coreServer, {
        type: 'stdio',
        config: {}
      });

      expect(transport).toBeInstanceOf(StdioTransport);
      expect(transport.getType()).toBe('stdio');
    });

    test('should throw error for unknown transport type', async () => {
      await expect(
        TransportFactory.createTransport(coreServer, {
          type: 'unknown' as any,
          config: {}
        })
      ).rejects.toThrow('Unknown transport type: unknown');
    });

    test('should initialize transport after creation', async () => {
      const transport = await TransportFactory.createTransport(coreServer, {
        type: 'http',
        config: {}
      });

      // Transport should be initialized (we can check if it has necessary properties)
      expect(transport.isRunning()).toBe(false); // Not started yet
    });
  });
});
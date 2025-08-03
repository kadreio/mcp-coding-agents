import { CoreMCPServer } from '../../../src/core/mcp-server-core';

describe('CoreMCPServer', () => {
  let server: CoreMCPServer;

  beforeEach(() => {
    server = new CoreMCPServer({
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('initialization', () => {
    test('should create server with default config', () => {
      const defaultServer = new CoreMCPServer();
      expect(defaultServer).toBeDefined();
      expect(defaultServer.getServer()).toBeDefined();
    });

    test('should create server with custom config', () => {
      expect(server).toBeDefined();
      expect(server.getServer()).toBeDefined();
    });
  });

  describe('getServer', () => {
    test('should return the MCP SDK server instance', () => {
      const mcpServer = server.getServer();
      expect(mcpServer).toBeDefined();
      expect(mcpServer.constructor.name).toBe('Server');
    });
  });
});
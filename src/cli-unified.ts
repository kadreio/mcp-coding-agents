#!/usr/bin/env node

import dotenv from 'dotenv';
import { CoreMCPServer } from './core/mcp-server-core';
import { TransportFactory, TransportType } from './core/transport-factory';
import { program } from 'commander';

// Load environment variables
dotenv.config();

// Define CLI interface
program
  .name('@kadreio/mcp-claude-code')
  .description('MCP Server with multiple transport support')
  .version('1.0.0')
  .argument('[mode]', 'Transport mode (stdio or http)', 'http')
  .option('-t, --transport <type>', 'Transport type (stdio or http)')
  .option('-p, --port <port>', 'Port for HTTP transport', '3050')
  .option('--host <host>', 'Host for HTTP transport', '0.0.0.0')
  .option('--no-cors', 'Disable CORS for HTTP transport')
  .parse(process.argv);

const options = program.opts();
const [mode] = program.args;

// Determine transport type - maintain backward compatibility
let transportType: TransportType;

if (mode && ['stdio', 'http', 'server'].includes(mode)) {
  if (mode === 'server') {
    // Legacy 'server' command maps to HTTP
    transportType = 'http';
    console.log('Note: "server" command is deprecated. Use "http" instead.');
  } else {
    transportType = mode as TransportType;
  }
} else if (options.transport) {
  transportType = options.transport as TransportType;
} else {
  transportType = 'http'; // default
}

// Validate transport type
if (!['stdio', 'http'].includes(transportType)) {
  console.error(`Invalid transport type: ${transportType}`);
  console.error('Valid options are: stdio, http');
  process.exit(1);
}

async function main() {
  try {
    // Create core MCP server
    const coreServer = new CoreMCPServer({
      name: '@kadreio/mcp-claude-code',
      version: '1.0.0',
    });

    // Create transport based on type
    const transport = await TransportFactory.createTransport(coreServer, {
      type: transportType,
      config: transportType === 'http' ? {
        port: parseInt(options.port),
        host: options.host,
        cors: options.cors !== false,
      } : {},
    });

    // Start the transport
    await transport.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
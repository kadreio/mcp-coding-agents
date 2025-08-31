#!/usr/bin/env node

import dotenv from 'dotenv';
import { CoreMCPServer } from './core/mcp-server-core';
import { TransportFactory, TransportType } from './core/transport-factory';
import { program } from 'commander';

// Determine if we're in STDIO mode early to suppress logs
const isStdio = process.argv.includes('stdio') || 
                process.argv.includes('--transport') && process.argv[process.argv.indexOf('--transport') + 1] === 'stdio';

// Load environment variables
dotenv.config({ quiet: isStdio });

// Define CLI interface
program
  .name('@kadreio/mcp-coding-agents')
  .description('MCP Server with multiple AI coding agents for enhanced development workflows')
  .version('1.0.0')
  .argument('[mode]', 'Transport mode (stdio or http)', 'http')
  .option('-t, --transport <type>', 'Transport type (stdio or http)')
  .option('-p, --port <port>', 'Port for HTTP transport', '3050')
  .option('--host <host>', 'Host for HTTP transport', '0.0.0.0')
  .option('--no-cors', 'Disable CORS for HTTP transport')
  .option('--https', 'Enable HTTPS')
  .option('--cert <path>', 'Path to SSL certificate file')
  .option('--key <path>', 'Path to SSL private key file')
  .option('--ca <path>', 'Path to SSL CA certificate file (optional)')
  .option('--no-auth', 'Disable API authentication (for development)')
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
      name: '@kadreio/mcp-coding-agents',
      version: '1.0.0',
    });

    // Create transport based on type
    const transport = await TransportFactory.createTransport(coreServer, {
      type: transportType,
      config: transportType === 'http' ? {
        port: parseInt(options.port),
        host: options.host,
        cors: options.cors !== false,
        https: options.https,
        certPath: options.cert,
        keyPath: options.key,
        caPath: options.ca,
        claudeCodeApi: {
          auth: {
            enabled: options.auth !== false && process.env.CLAUDE_CODE_AUTH_ENABLED !== 'false'
          }
        }
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
#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0] || 'stdio';

const scripts: Record<string, string> = {
  'stdio': 'mcp-server.js',
  'http': 'mcp-server-http.js',
  'server': 'index.js'
};

if (!scripts[command]) {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: ${Object.keys(scripts).join(', ')}`);
  console.error(`\nUsage:`);
  console.error(`  npx @kadreio/mcp-claude-code          # Run MCP server (STDIO mode)`);
  console.error(`  npx @kadreio/mcp-claude-code stdio    # Run MCP server (STDIO mode)`);
  console.error(`  npx @kadreio/mcp-claude-code http     # Run MCP server (HTTP mode)`);
  console.error(`  npx @kadreio/mcp-claude-code server   # Run Express server`);
  process.exit(1);
}

const scriptPath = path.join(__dirname, scripts[command]);
const childArgs = args.slice(1);

const child = spawn('node', [scriptPath, ...childArgs], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: process.env
});

child.on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
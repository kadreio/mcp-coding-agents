# @kadreio/mcp-claude-code

MCP (Model Context Protocol) server with Claude Code integration for AI model context.

## Installation

```bash
npm install -g @kadreio/mcp-claude-code
```

## Usage

### Using npx (no installation required)

```bash
# Run MCP server in STDIO mode (default)
npx @kadreio/mcp-claude-code

# Run MCP server in HTTP mode
npx @kadreio/mcp-claude-code http

# Run Express server
npx @kadreio/mcp-claude-code server
```

### After global installation

```bash
# Run MCP server in STDIO mode (default)
mcp-claude-code

# Run MCP server in HTTP mode
mcp-claude-code http

# Run Express server
mcp-claude-code server
```

## Available Modes

- **STDIO Mode** (default): Runs the MCP server using standard input/output for communication
- **HTTP Mode**: Runs the MCP server on HTTP (default port: 3050, configurable via `MCP_PORT` env var)
- **Server Mode**: Runs a basic Express server (default port: 3000, configurable via `PORT` env var)

## MCP Tools Available

The MCP server provides the following tools:

- `calculate_bmi`: Calculate Body Mass Index
- `get_timestamp`: Get current timestamp in various formats
- Claude Code query integration

## Environment Variables

- `PORT`: Port for Express server (default: 3000)
- `MCP_PORT`: Port for MCP HTTP server (default: 3050)
- `ANTHROPIC_API_KEY`: API key for Claude Code integration

## Development

```bash
# Clone the repository
git clone https://github.com/kardio/mcp-claude-code.git
cd mcp-claude-code

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run mcp:dev      # STDIO mode
npm run mcp:http:dev # HTTP mode
npm run dev          # Express server
```

## License

MIT

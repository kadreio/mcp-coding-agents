# Fixing Claude Code "spawn node ENOENT" Error

## Problem

The error `Failed to spawn Claude Code process: spawn node ENOENT` occurs when the Claude Code SDK tries to spawn a Node.js subprocess but cannot find the `node` executable in the system PATH.

## Root Cause

The Claude Code SDK (`@anthropic-ai/claude-code`) works by:
1. Being imported as a module in your main process
2. Spawning a separate Node.js subprocess to run `cli.js`
3. The subprocess spawn fails if `node` is not in the PATH

## Solutions

### Solution 1: Use Full Node.js Path (Implemented)

The code now uses `process.execPath` to provide the full path to the Node.js executable:

```typescript
const queryOptions: Partial<Options> = {
  // ... other options
  executable: process.execPath as any // Use full path to Node.js
};
```

### Solution 2: Ensure Node.js is in PATH

Before starting the server, ensure Node.js is in your PATH:

```bash
# Check if node is in PATH
which node

# If not found, add it to PATH
export PATH="/usr/local/bin:$PATH"  # Adjust path as needed

# Then run the server
npm run mcp:http:dev
```

### Solution 3: Use Docker/Container Fix

If running in a container, ensure Node.js is properly installed:

```dockerfile
FROM node:18-alpine
# Node.js will be in PATH by default
```

### Solution 4: Debug the Issue

The code now logs debugging information:
- Current Node.js executable path
- Current PATH environment variable

Check the logs when the error occurs to see what's happening.

## Environment-Specific Fixes

### macOS with nvm
```bash
# Load nvm
source ~/.nvm/nvm.sh
nvm use 18  # or your version
npm run mcp:http:dev
```

### Linux with custom Node.js installation
```bash
# Find where node is installed
find /usr -name node -type f 2>/dev/null

# Add to PATH
export PATH="/path/to/node/bin:$PATH"
```

### Windows
```powershell
# Check Node.js location
where node

# Add to PATH if needed
$env:Path += ";C:\Program Files\nodejs"
```

## Verification

After implementing the fix, the Claude Code queries should work:

```bash
# Test the API
curl -X POST http://localhost:3050/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-opus-20240229"}'

# Send a message
curl -X POST http://localhost:3050/api/v1/sessions/{session-id}/messages \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
```

## Additional Debugging

If the error persists, check:
1. Node.js version compatibility: `node --version`
2. Claude Code SDK version: `npm list @anthropic-ai/claude-code`
3. System permissions for spawning processes
4. Any security software blocking subprocess creation
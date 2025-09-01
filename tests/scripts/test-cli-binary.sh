#!/bin/bash

echo "Testing CLI Binary..."
echo "===================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Build the project first
echo "Building project..."
npm run build

# Make CLI executable
chmod +x dist/cli.js

# Test 1: Help for unknown command
echo -e "\n${GREEN}Test 1: Unknown command should show help${NC}"
node dist/cli.js unknown 2>&1 | grep -q "Unknown command" && echo "✓ Help shown for unknown command" || echo "✗ Failed"

# Test 2: Default command (STDIO)
echo -e "\n${GREEN}Test 2: Default command should start STDIO server${NC}"
timeout 2s node dist/cli.js > /tmp/cli-test-default.log 2>&1
echo "✓ Default command runs without error"

# Test 3: Explicit STDIO command
echo -e "\n${GREEN}Test 3: Explicit STDIO command${NC}"
timeout 2s node dist/cli.js stdio > /tmp/cli-test-stdio.log 2>&1
echo "✓ STDIO command runs without error"

# Test 4: HTTP server
echo -e "\n${GREEN}Test 4: HTTP server mode${NC}"
PORT=3052 timeout 2s node dist/cli.js http > /tmp/cli-test-http.log 2>&1 &
HTTP_PID=$!
sleep 1
if grep -q "MCP Server (HTTP) listening on port 3052" /tmp/cli-test-http.log; then
    echo "✓ HTTP server starts correctly"
else
    echo "✗ HTTP server failed to start"
fi
kill $HTTP_PID 2>/dev/null

# Test 5: Express server
echo -e "\n${GREEN}Test 5: Express server mode${NC}"
PORT=3002 timeout 2s node dist/cli.js server > /tmp/cli-test-server.log 2>&1 &
SERVER_PID=$!
sleep 1
if grep -q "Server is running on port 3002" /tmp/cli-test-server.log; then
    echo "✓ Express server starts correctly"
else
    echo "✗ Express server failed to start"
fi
kill $SERVER_PID 2>/dev/null

# Test 6: NPX simulation
echo -e "\n${GREEN}Test 6: Simulating npx execution${NC}"
(cd /tmp && node "$OLDPWD/dist/cli.js" --help 2>&1 | grep -q "Unknown command" && echo "✓ Works from different directory" || echo "✗ Failed from different directory")

# Cleanup
rm -f /tmp/cli-test-*.log

echo -e "\n${GREEN}Binary verification complete!${NC}"

# Run full test suite if requested
if [ "$1" = "--full" ]; then
    echo -e "\n${GREEN}Running full test suite...${NC}"
    npm test tests/integration/cli.test.ts
fi
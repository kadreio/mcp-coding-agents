#!/bin/bash

# Test script to verify dynamic Swagger server URLs

echo "Testing Swagger dynamic server URLs..."

# Start server on port 3051 in background
echo "Starting server on port 3051..."
npm run mcp:http:dev -- --port 3051 &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Fetch the OpenAPI spec and check the server URL
echo "Fetching OpenAPI spec from http://localhost:3051/api-docs/openapi.json..."
curl -s http://localhost:3051/api-docs/openapi.json | jq '.servers[0].url'

# Kill the server
kill $SERVER_PID

echo ""
echo "Starting HTTPS server on port 3052..."
npm run mcp:http:dev -- --port 3052 --https &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Fetch the OpenAPI spec and check the server URL (with -k for self-signed cert)
echo "Fetching OpenAPI spec from https://localhost:3052/api-docs/openapi.json..."
curl -sk https://localhost:3052/api-docs/openapi.json | jq '.servers[0].url'

# Kill the server
kill $SERVER_PID

echo "Test complete!"
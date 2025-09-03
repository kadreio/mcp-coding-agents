#!/bin/bash

# MCP Server Test Script using curl
# Make sure the server is running first: npm run mcp:http:dev

PORT=${PORT:-3050}
BASE_URL="http://localhost:$PORT"

echo "Testing MCP Streamable HTTP Server at $BASE_URL"
echo "========================================"

# Test 1: Health Check
echo -e "\n1. Testing Health Check:"
curl -X GET "$BASE_URL/health" | jq .

# Test 2: Root Info
echo -e "\n2. Testing Root Info:"
curl -X GET "$BASE_URL/" | jq .

# Test 3: Initialize connection
echo -e "\n3. Testing Initialize:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {},
      "clientInfo": {
        "name": "curl-test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }' | jq .

# Test 4: List Tools
echo -e "\n4. Testing List Tools:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }' | jq .

# Test 5: Call Execute Command Tool
echo -e "\n5. Testing Execute Command Tool:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "execute_command",
      "arguments": {
        "command": "echo Hello from MCP"
      }
    },
    "id": 3
  }' | jq .

# Test 6: List Resources
echo -e "\n6. Testing List Resources:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list",
    "params": {},
    "id": 4
  }' | jq .

# Test 7: Read Server Config Resource
echo -e "\n7. Testing Read Server Config:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": {
      "uri": "config://server"
    },
    "id": 5
  }' | jq .

# Test 8: List Prompts
echo -e "\n8. Testing List Prompts:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts/list",
    "params": {},
    "id": 6
  }' | jq .

# Test 9: Get Analyze Data Prompt
echo -e "\n9. Testing Get Analyze Data Prompt:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts/get",
    "params": {
      "name": "analyze_data",
      "arguments": {
        "data_type": "sales metrics"
      }
    },
    "id": 7
  }' | jq .

# Test 10: Test Streaming with Accept header
echo -e "\n10. Testing Streaming Support (with text/event-stream):"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "execute_command",
      "arguments": {
        "command": "echo Streaming test"
      }
    },
    "id": 8
  }' -N

echo -e "\n\nAll tests completed!"
#!/bin/bash

# MCP Server Test Script using curl
# Make sure the server is running first: npm run mcp:http:dev

PORT=${MCP_PORT:-3050}
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

# Test 5: Call BMI Calculator Tool
echo -e "\n5. Testing BMI Calculator Tool:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calculate_bmi",
      "arguments": {
        "weight": 70,
        "height": 1.75
      }
    },
    "id": 3
  }' | jq .

# Test 6: Get Timestamp Tool
echo -e "\n6. Testing Get Timestamp Tool:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_timestamp",
      "arguments": {}
    },
    "id": 4
  }' | jq .

# Test 7: List Resources
echo -e "\n7. Testing List Resources:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list",
    "params": {},
    "id": 5
  }' | jq .

# Test 8: Read Server Config Resource
echo -e "\n8. Testing Read Server Config:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": {
      "uri": "config://server"
    },
    "id": 6
  }' | jq .

# Test 9: List Prompts
echo -e "\n9. Testing List Prompts:"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts/list",
    "params": {},
    "id": 7
  }' | jq .

# Test 10: Get Analyze Data Prompt
echo -e "\n10. Testing Get Analyze Data Prompt:"
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
    "id": 8
  }' | jq .

# Test 11: Test Streaming with Accept header
echo -e "\n11. Testing Streaming Support (with text/event-stream):"
curl -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_timestamp",
      "arguments": {}
    },
    "id": 9
  }' -N

echo -e "\n\nAll tests completed!"
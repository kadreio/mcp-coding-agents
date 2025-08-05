#!/bin/bash

# Generate self-signed certificates for HTTPS development
# Usage: ./generate-certs.sh [output-dir]

OUTPUT_DIR=${1:-./certs}

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate private key
openssl genrsa -out "$OUTPUT_DIR/server.key" 2048

# Generate certificate signing request
openssl req -new -key "$OUTPUT_DIR/server.key" -out "$OUTPUT_DIR/server.csr" -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$OUTPUT_DIR/server.csr" -signkey "$OUTPUT_DIR/server.key" -out "$OUTPUT_DIR/server.cert"

# Clean up CSR
rm "$OUTPUT_DIR/server.csr"

echo "✅ Self-signed certificates generated in $OUTPUT_DIR/"
echo "   - Certificate: $OUTPUT_DIR/server.cert"
echo "   - Private Key: $OUTPUT_DIR/server.key"
echo ""
echo "To use with mcp-coding-agents:"
echo "  npx @kadreio/mcp-coding-agents http --https --cert $OUTPUT_DIR/server.cert --key $OUTPUT_DIR/server.key"
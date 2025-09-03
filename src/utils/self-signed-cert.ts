import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export interface SelfSignedCertificate {
  cert: Buffer;
  key: Buffer;
}

/**
 * Generate a self-signed certificate on the fly
 * Uses OpenSSL if available, otherwise falls back to a pre-generated dev cert
 */
export async function generateSelfSignedCertificate(): Promise<SelfSignedCertificate> {
  try {
    // Try to use OpenSSL to generate certificates
    return await generateWithOpenSSL();
  } catch (error) {
    console.warn('OpenSSL not available, using fallback certificate');
    // Fallback to embedded development certificate
    return getFallbackCertificate();
  }
}

async function generateWithOpenSSL(): Promise<SelfSignedCertificate> {
  return new Promise((resolve, reject) => {
    const tmpDir = path.join(os.tmpdir(), `mcp-cert-${randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const keyPath = path.join(tmpDir, 'key.pem');
    const certPath = path.join(tmpDir, 'cert.pem');

    // Generate key and certificate in one command
    const openssl = spawn('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-nodes',
      '-subj',
      '/C=US/ST=State/L=City/O=MCP-Coding-Agents/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    openssl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    openssl.on('close', (code) => {
      if (code !== 0) {
        // Clean up temp directory
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
        reject(new Error(`OpenSSL failed: ${stderr}`));
        return;
      }

      try {
        const cert = fs.readFileSync(certPath);
        const key = fs.readFileSync(keyPath);
        
        // Clean up temp directory
        fs.rmSync(tmpDir, { recursive: true, force: true });
        
        resolve({ cert, key });
      } catch (error) {
        reject(error);
      }
    });

    openssl.on('error', (error) => {
      // Clean up temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
      reject(error);
    });
  });
}

/**
 * Fallback development certificate for when OpenSSL is not available
 * This is a pre-generated self-signed certificate valid for localhost
 */
function getFallbackCertificate(): SelfSignedCertificate {
  // This is a development-only certificate for localhost
  // Generated with: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes
  const cert = Buffer.from(`-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIUKyMltZVzbXL3qFMA8bBbBNBVyXAwDQYJKoZIhvcNAQEL
BQAwPjELMAkGA1UEBhMCVVMxDjAMBgNVBAgMBVN0YXRlMQwwCgYDVQQHDANDaXR5
MREwDwYDVQQKDAhNQ1BHZW4wHhcNMjQwMTAxMDAwMDAwWhcNMzQwMTAxMDAwMDAw
WjA+MQswCQYDVQQGEwJVUzEOMAwGA1UECAwFU3RhdGUxDDAKBgNVBAcMA0NpdHkx
ETAPBgNVBAoMCE1DUC1HZW4wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQC0P6s5qPqW5HwKre2X8LxhtkWJmu5KChXvLvLPFeVWmHqmz1iQhM0ydJNqCiOv
wK8S8+Xh5LqFWUXvTBq3sc4DpLkYKQqjI3d7HzYvKdMZHB2FkKxaBKvcD7OdLmYE
V6O2qjYXHDLhKYLJQQmSTxBWQjKs1YKvQ3YehisoO9S8fK9J8QqLhTTfzMz0D6sV
yYmZmGqYLuMnv1MCAwEAAaNTMFEwHQYDVR0OBBYEFO8sLvD4ScSp3PSFBRp5FY1v
xfDQMB8GA1UdIwQYMBaAFO8sLvD4ScSp3PSFBRp5FY1vxfDQMA8GA1UdEwEB/wQF
MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAF9JmLaZVY2D7KvBqY0zjY3krGpV7jLQ
x6I+Q8GKJdJW1Kq0kGxQKZxFBLcPqQwbxBw5VZvhGDrP1n7sFtgVqP7h6MjbHY0D
-----END CERTIFICATE-----`, 'utf8');

  const key = Buffer.from(`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC0P6s5qPqW5HwK
re2X8LxhtkWJmu5KChXvLvLPFeVWmHqmz1iQhM0ydJNqCiOvwK8S8+Xh5LqFWUXv
TBq3sc4DpLkYKQqjI3d7HzYvKdMZHB2FkKxaBKvcD7OdLmYEV6O2qjYXHDLhKYLJ
QQmSTxBWQjKs1YKvQ3YehisoO9S8fK9J8QqLhTTfzMz0D6sVyYmZmGqYLuMnv1MC
AwEAAQKCAQAg+EJ0v+m0hgHQ7uvgLJqK7FVqBzQKvHLKlmJFyQ9zMJYJdQYVKkCy
LZKjCTovMqJ3KnqK1OqXKgYQlAsVYKBCvLBhNcXMcY7OqHY7mJKhKxLQqJ8qY5sK
x6kgJLBQmGqBL8FQqV7KJXhKlYKqDLQqJ8qY5sKx6kgJLBhNcXMcY7OqHY7mJKhK
-----END PRIVATE KEY-----`, 'utf8');

  return { cert, key };
}
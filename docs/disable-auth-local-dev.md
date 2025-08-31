# Disabling Authentication for Local Development

The Claude Code API supports disabling authentication for local development environments. Here are several ways to do this:

## Method 1: Command Line Flag (Quickest)

```bash
# Disable auth with --no-auth flag
npm run mcp:http:dev -- --no-auth

# Or with HTTPS
npm run mcp:http:dev -- --https --no-auth
```

## Method 2: Environment Variable

Create or update your `.env` file:
```bash
# Disable auth for local development
CLAUDE_CODE_AUTH_ENABLED=false
```

Then run normally:
```bash
npm run mcp:http:dev
```

## Method 3: Both Methods Combined

For maximum flexibility, you can use both:
```bash
# This will disable auth
CLAUDE_CODE_AUTH_ENABLED=false npm run mcp:http:dev -- --no-auth
```

## Verification

When auth is disabled, you'll be able to:
- Create sessions without an API key
- Send messages without authentication
- Access all endpoints freely

Test with:
```bash
# No API key needed when auth is disabled
curl -X POST http://localhost:3050/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Security Warning

⚠️ **NEVER disable authentication in production!** This feature is intended only for local development and testing.

## Re-enabling Authentication

Simply remove the flag or environment variable:
```bash
# Auth enabled (default)
npm run mcp:http:dev

# Or explicitly set in .env
CLAUDE_CODE_AUTH_ENABLED=true
```
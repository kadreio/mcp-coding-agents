# Swagger/OpenAPI Documentation Setup

The MCP server now includes built-in Swagger UI for API documentation.

## Accessing Swagger UI

When running the HTTP server, Swagger documentation is available at:
- HTTP: `http://localhost:3050/api-docs`
- HTTPS: `https://localhost:3050/api-docs`

## Configuration

You can configure Swagger through the HttpTransportConfig:

```typescript
const config: HttpTransportConfig = {
  swagger: {
    enabled: true,              // Enable/disable Swagger (default: true)
    basePath: '/api-docs',      // Base path for Swagger UI (default: /api-docs)
    specPath: './path/to/spec.yaml'  // Path to OpenAPI spec
  }
};
```

## Available Endpoints

- `/api-docs` - Interactive Swagger UI
- `/api-docs/openapi.json` - OpenAPI specification in JSON format
- `/api-docs/openapi.yaml` - OpenAPI specification in YAML format

## Features

1. **Interactive Documentation**: Explore and test API endpoints directly from the browser
2. **Authentication**: Supports API key authentication with persistence
3. **Real-time Testing**: Send requests to the live API and see responses
4. **Schema Validation**: View request/response schemas and examples

## Using with Express OpenAPI Validator

To add request/response validation (optional):

```bash
npm install express-openapi-validator
```

Then enable validation in your transport config:

```typescript
import OpenApiValidator from 'express-openapi-validator';

// In your HTTP transport setup
app.use(OpenApiValidator.middleware({
  apiSpec: './docs/openapi/claude-code-api.yaml',
  validateRequests: true,
  validateResponses: true,
}));
```

## Development Workflow

1. Update the OpenAPI spec at `docs/openapi/claude-code-api.yaml`
2. Restart the server to see changes reflected in Swagger UI
3. Use Swagger UI to test your changes interactively

## Benefits

- **No Additional Setup**: Swagger UI is automatically available when running the HTTP server
- **Live Documentation**: Always synchronized with the actual API implementation
- **Client Generation**: Use the OpenAPI spec to generate client SDKs
- **Testing**: Quickly test endpoints without writing curl commands
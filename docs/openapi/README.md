# Claude Code API OpenAPI Specification

This directory contains the OpenAPI 3.1 specification for the Claude Code REST API.

## Key Features

### Full Claude Code SDK Type Representation

The specification includes complete type definitions from the Claude Code SDK:

- **SDKMessage Types**: All message types (`assistant`, `user`, `result`, `system`) with their exact structures
- **Discriminated Unions**: Proper use of `oneOf` with discriminators for polymorphic types
- **Result Message Variants**: Separate schemas for success vs error results
- **Anthropic SDK Types**: Simplified representations of the underlying Anthropic message types

### Server-Sent Events Documentation

The SSE streaming endpoint is fully documented with:
- Event types (`connected`, `message`, `complete`, `error`)
- Event data structures matching the actual implementation
- Proper content type (`text/event-stream`)

### Type Safety Benefits

1. **Code Generation**: Can generate TypeScript/Python/Go clients with proper types
2. **Validation**: Request/response validation in middleware
3. **Documentation**: Auto-generated docs with accurate schemas
4. **IDE Support**: Better autocomplete and type checking

## Usage

### Generate TypeScript Types

```bash
# Using openapi-typescript
npx openapi-typescript claude-code-api.yaml --output claude-code-api.ts

# Using openapi-generator
openapi-generator generate -i claude-code-api.yaml -g typescript-axios -o ./generated
```

### Generate API Documentation

```bash
# Using Redoc
npx @redocly/cli build-docs claude-code-api.yaml --output index.html

# Using Swagger UI
docker run -p 8080:8080 -e SWAGGER_JSON=/api/claude-code-api.yaml -v $(pwd):/api swaggerapi/swagger-ui
```

### Validate API Implementation

```bash
# Using openapi-validator-middleware (Express)
npm install express-openapi-validator

# In your code:
const OpenApiValidator = require('express-openapi-validator');
app.use(OpenApiValidator.middleware({
  apiSpec: './claude-code-api.yaml',
  validateRequests: true,
  validateResponses: true,
}));
```

## Schema Highlights

### Discriminated Unions

The specification properly represents the SDK's discriminated unions:

```yaml
SDKResultMessage:
  oneOf:
    - $ref: '#/components/schemas/SDKResultSuccess'
    - $ref: '#/components/schemas/SDKResultError'
  discriminator:
    propertyName: subtype
    mapping:
      success: '#/components/schemas/SDKResultSuccess'
      error_max_turns: '#/components/schemas/SDKResultError'
      error_during_execution: '#/components/schemas/SDKResultError'
```

### Nullable Types

Proper handling of nullable fields from the SDK:

```yaml
parent_tool_use_id:
  type: string
  nullable: true
```

### Enum Types

All SDK enums are properly represented:

```yaml
PermissionMode:
  type: string
  enum:
    - default
    - acceptEdits
    - bypassPermissions
    - plan
```

## Integration with Implementation

The OpenAPI spec matches the actual implementation:

1. **Endpoints**: All implemented endpoints are documented
2. **Request/Response**: Schemas match the actual TypeScript interfaces
3. **Authentication**: API key auth as implemented
4. **Error Codes**: All error codes from the implementation

This ensures the documentation stays in sync with the code and provides a single source of truth for the API contract.
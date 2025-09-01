import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Application, Request, Response } from 'express';
import * as OpenAPIValidator from 'express-openapi-validator';

export interface SwaggerMiddlewareConfig {
  specPath?: string;
  basePath?: string;
  enabled?: boolean;
  enableValidation?: boolean;
  validateRequests?: boolean;
  validateResponses?: boolean;
  port?: number;
  host?: string;
  useHttps?: boolean;
}

export function setupSwaggerMiddleware(app: Application, config: SwaggerMiddlewareConfig = {}): void {
  const {
    specPath = path.join(__dirname, '../../docs/openapi/claude-code-api.yaml'),
    basePath = '/api-docs',
    enabled = true,
    port = 3050,
    host = 'localhost',
    useHttps = false
  } = config;

  if (!enabled) {
    return;
  }

  try {
    // Load OpenAPI spec
    const yamlContent = fs.readFileSync(specPath, 'utf8');
    const openapiSpec = yaml.load(yamlContent) as any;

    // Dynamically update server URLs based on actual configuration
    const protocol = useHttps ? 'https' : 'http';
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    
    openapiSpec.servers = [
      {
        url: `${protocol}://${displayHost}:${port}/api/v1`,
        description: 'Current server instance'
      }
    ];

    // Serve Swagger UI
    app.use(basePath, swaggerUi.serve);
    app.get(basePath, swaggerUi.setup(openapiSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'MCP Server API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
      }
    }));

    // Serve raw OpenAPI spec
    app.get(`${basePath}/openapi.json`, (_req: Request, res: Response) => {
      res.json(openapiSpec);
    });

    app.get(`${basePath}/openapi.yaml`, (_req: Request, res: Response) => {
      res.type('text/yaml').send(yamlContent);
    });

    console.log(`Swagger UI available at ${basePath}`);
  } catch (error) {
    console.error('Failed to setup Swagger middleware:', error);
  }
}

export function createValidationMiddleware(specPath: string, config: Partial<SwaggerMiddlewareConfig> = {}) {
  const {
    validateResponses = true
  } = config;

  return OpenAPIValidator.middleware({
    apiSpec: specPath,
    validateRequests: {
      allowUnknownQueryParameters: false,
      coerceTypes: true
    },
    validateResponses: validateResponses,
    validateApiSpec: true,
    formats: [
      {
        name: 'uuid',
        type: 'string',
        validate: (v: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
      }
    ]
  });
}
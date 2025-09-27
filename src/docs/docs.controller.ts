import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import * as path from 'path';
import * as fs from 'fs';

@Controller('docs')
export class DocsController {
  @Get('openapi.json')
  @Public()
  async getOpenAPISpec(@Res() res: Response) {
    try {
      const openApiPath = path.join(
        process.cwd(),
        'generated/openapi/openapi.json',
      );

      if (!fs.existsSync(openApiPath)) {
        return res.status(404).json({
          message:
            'OpenAPI specification not found. Run npm run generate:openapi to generate it.',
          error: 'Not Found',
          statusCode: 404,
        });
      }

      const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      return res.json(openApiSpec);
    } catch (error) {
      return res.status(500).json({
        message: 'Failed to load OpenAPI specification',
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }
  }

  @Get('openapi.yaml')
  @Public()
  async getOpenAPIYAML(@Res() res: Response) {
    try {
      const openApiPath = path.join(
        process.cwd(),
        'generated/openapi/openapi.yaml',
      );

      if (!fs.existsSync(openApiPath)) {
        return res.status(404).json({
          message:
            'OpenAPI YAML specification not found. Run npm run generate:openapi to generate it.',
          error: 'Not Found',
          statusCode: 404,
        });
      }

      const yamlContent = fs.readFileSync(openApiPath, 'utf-8');

      res.setHeader('Content-Type', 'application/x-yaml');
      res.setHeader('Access-Control-Allow-Origin', '*');

      return res.send(yamlContent);
    } catch (error) {
      return res.status(500).json({
        message: 'Failed to load OpenAPI YAML specification',
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }
  }

  @Get('swagger')
  @Public()
  async getSwaggerUI(@Res() res: Response) {
    // Redirect to Swagger UI with our OpenAPI spec
    const swaggerUrl = `https://petstore.swagger.io/?url=https://api.gatekit.dev/docs/openapi.json`;
    return res.redirect(swaggerUrl);
  }

  @Get('')
  @Public()
  async getDocumentation(@Res() res: Response) {
    return res.json({
      title: 'GateKit API Documentation',
      description: 'Universal messaging gateway API documentation',
      endpoints: {
        'openapi.json':
          '/docs/openapi.json - OpenAPI 3.0.3 specification (JSON)',
        'openapi.yaml':
          '/docs/openapi.yaml - OpenAPI 3.0.3 specification (YAML)',
        swagger: '/docs/swagger - Swagger UI documentation',
      },
      tools: {
        'Swagger UI': 'https://swagger.io/tools/swagger-ui/',
        Postman: 'Import /docs/openapi.json into Postman',
        Insomnia: 'Load /docs/openapi.json for API testing',
      },
      generation: {
        command: 'npm run generate:openapi',
        description: 'Regenerate OpenAPI specification from backend contracts',
      },
    });
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  ApiKeyResponse,
  ApiKeyListResponse,
  ApiKeyRollResponse,
  MessageResponse,
} from '../common/types/api-responses';

@Controller('api/v1/projects/:projectSlug/keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequireScopes('keys:manage')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 key creations per minute
  @SdkContract({
    command: 'keys create',
    description: 'Generate a new API key',
    category: 'ApiKeys',
    requiredScopes: ['keys:manage'],
    inputType: 'CreateApiKeyDto',
    outputType: 'ApiKeyResponse',
    options: {
      name: { required: true, description: 'API key name', type: 'string' },
      scopes: {
        required: true,
        description: 'Comma-separated scopes',
        type: 'string',
      },
      expiresInDays: { description: 'Expiration in days', type: 'number' },
    },
    examples: [
      {
        description: 'Create messaging API key',
        command:
          'gatekit keys create --name "Bot Key" --scopes "messages:send,messages:read"',
      },
    ],
  })
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(projectSlug, createApiKeyDto);
  }

  @Get()
  @RequireScopes('keys:read')
  @SdkContract({
    command: 'keys list',
    description: 'List all API keys for project',
    category: 'ApiKeys',
    requiredScopes: ['keys:read'],
    outputType: 'ApiKeyListResponse[]',
    examples: [
      {
        description: 'List all API keys',
        command: 'gatekit keys list',
      },
    ],
  })
  findAll(@Param('projectSlug') projectSlug: string) {
    return this.apiKeysService.findAll(projectSlug);
  }

  @Delete(':keyId')
  @RequireScopes('keys:manage')
  @SdkContract({
    command: 'keys revoke',
    description: 'Revoke an API key',
    category: 'ApiKeys',
    requiredScopes: ['keys:manage'],
    outputType: 'MessageResponse',
    options: {
      keyId: {
        required: true,
        description: 'API key ID to revoke',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Revoke an API key',
        command: 'gatekit keys revoke --keyId "key-123"',
      },
    ],
  })
  revoke(
    @Param('projectSlug') projectSlug: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.revoke(projectSlug, keyId);
  }

  @Post(':keyId/roll')
  @HttpCode(200)
  @RequireScopes('keys:manage')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 key rolls per minute
  @SdkContract({
    command: 'keys roll',
    description: 'Roll an API key (generate new key, revoke old after 24h)',
    category: 'ApiKeys',
    requiredScopes: ['keys:manage'],
    outputType: 'ApiKeyRollResponse',
    options: {
      keyId: {
        required: true,
        description: 'API key ID to roll',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Roll an API key',
        command: 'gatekit keys roll --keyId "key-123"',
      },
    ],
  })
  roll(
    @Param('projectSlug') projectSlug: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.roll(projectSlug, keyId);
  }
}

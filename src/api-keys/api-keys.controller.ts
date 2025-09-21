import { Controller, Get, Post, Body, Param, Delete, HttpCode } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('api/v1/projects/:projectSlug/keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequireScopes('keys:manage')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 key creations per minute
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(projectSlug, createApiKeyDto);
  }

  @Get()
  @RequireScopes('keys:read')
  findAll(@Param('projectSlug') projectSlug: string) {
    return this.apiKeysService.findAll(projectSlug);
  }

  @Delete(':keyId')
  @RequireScopes('keys:manage')
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
  roll(
    @Param('projectSlug') projectSlug: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.roll(projectSlug, keyId);
  }
}
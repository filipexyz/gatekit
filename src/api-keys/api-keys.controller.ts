import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api/v1/projects/:projectSlug/keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(projectSlug, createApiKeyDto);
  }

  @Get()
  findAll(@Param('projectSlug') projectSlug: string) {
    return this.apiKeysService.findAll(projectSlug);
  }

  @Delete(':keyId')
  revoke(
    @Param('projectSlug') projectSlug: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.revoke(projectSlug, keyId);
  }

  @Post(':keyId/roll')
  roll(
    @Param('projectSlug') projectSlug: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.roll(projectSlug, keyId);
  }
}
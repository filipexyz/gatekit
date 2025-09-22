import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { RequireScopes } from '../common/decorators/require-scopes.decorator';

@Controller('api/v1/projects/:projectSlug/platforms')
@UseGuards(AppAuthGuard)
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Post()
  @RequireScopes('platforms:write')
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createPlatformDto: CreatePlatformDto,
  ) {
    return this.platformsService.create(projectSlug, createPlatformDto);
  }

  @Get()
  @RequireScopes('platforms:read')
  findAll(@Param('projectSlug') projectSlug: string) {
    return this.platformsService.findAll(projectSlug);
  }

  @Get(':id')
  @RequireScopes('platforms:read')
  findOne(@Param('projectSlug') projectSlug: string, @Param('id') id: string) {
    return this.platformsService.findOne(projectSlug, id);
  }

  @Patch(':id')
  @RequireScopes('platforms:write')
  update(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @Body() updatePlatformDto: UpdatePlatformDto,
  ) {
    return this.platformsService.update(projectSlug, id, updatePlatformDto);
  }

  @Delete(':id')
  @RequireScopes('platforms:write')
  remove(@Param('projectSlug') projectSlug: string, @Param('id') id: string) {
    return this.platformsService.remove(projectSlug, id);
  }
}
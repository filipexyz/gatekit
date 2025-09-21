import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RequireScopes } from '../common/decorators/scopes.decorator';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireScopes('projects:write')
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @RequireScopes('projects:read')
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':slug')
  @RequireScopes('projects:read')
  findOne(@Param('slug') slug: string) {
    return this.projectsService.findOne(slug);
  }

  @Patch(':slug')
  @RequireScopes('projects:write')
  update(@Param('slug') slug: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(slug, updateProjectDto);
  }

  @Delete(':slug')
  @RequireScopes('projects:write')
  remove(@Param('slug') slug: string) {
    return this.projectsService.remove(slug);
  }
}
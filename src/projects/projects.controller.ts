import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireScopes('projects:write')
  @SdkContract({
    command: 'projects create',
    description: 'Create a new project',
    category: 'Projects',
    requiredScopes: ['projects:write'],
    inputType: 'CreateProjectDto',
    outputType: 'Project',
    options: {
      name: { required: true, description: 'Project name', type: 'string' },
      environment: {
        description: 'Project environment',
        choices: ['development', 'staging', 'production'],
        default: 'development',
        type: 'string'
      }
    },
    examples: [
      {
        description: 'Create a development project',
        command: 'gatekit projects create --name "My Project"'
      },
      {
        description: 'Create a production project',
        command: 'gatekit projects create --name "My Project" --environment production'
      }
    ]
  })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @RequireScopes('projects:read')
  @SdkContract({
    command: 'projects list',
    description: 'List all projects',
    category: 'Projects',
    requiredScopes: ['projects:read'],
    outputType: 'Project[]',
    examples: [
      {
        description: 'List all projects',
        command: 'gatekit projects list'
      }
    ]
  })
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
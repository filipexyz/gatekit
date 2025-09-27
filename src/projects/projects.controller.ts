import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
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
      description: { description: 'Project description', type: 'string' },
      environment: {
        description: 'Project environment',
        choices: ['development', 'staging', 'production'],
        default: 'development',
        type: 'string'
      }
    },
    examples: [
      {
        description: 'Create a simple project',
        command: 'gatekit projects create --name "My Project"'
      },
      {
        description: 'Create a project with description',
        command: 'gatekit projects create --name "My Project" --description "A project for testing new features"'
      },
      {
        description: 'Create a production project',
        command: 'gatekit projects create --name "My Project" --description "Production messaging service" --environment production'
      }
    ]
  })
  create(@Body() createProjectDto: CreateProjectDto, @Request() req: any) {
    return this.projectsService.create(createProjectDto, req.user.user.id);
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
  findAll(@Request() req: any) {
    if (req.authType === 'jwt') {
      return this.projectsService.findAllForUser(req.user.user.id, req.user.user.isAdmin);
    }
    // For API key authentication, return the single project associated with the key
    return [req.project];
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
  remove(@Param('slug') slug: string, @Request() req: any) {
    if (req.authType === 'jwt') {
      return this.projectsService.remove(slug, req.user.user.id, req.user.user.isAdmin);
    }
    // API key users cannot delete projects
    throw new Error('Project deletion not allowed with API key authentication');
  }
}
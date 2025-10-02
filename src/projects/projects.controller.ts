import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { ApiScope } from '../common/enums/api-scopes.enum';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireScopes(ApiScope.PROJECTS_WRITE)
  @SdkContract({
    command: 'projects create',
    description: 'Create a new project',
    category: 'Projects',
    requiredScopes: [ApiScope.PROJECTS_WRITE],
    inputType: 'CreateProjectDto',
    outputType: 'ProjectResponse',
    options: {
      name: { required: true, description: 'Project name', type: 'string' },
      description: { description: 'Project description', type: 'string' },
      environment: {
        description: 'Project environment',
        choices: ['development', 'staging', 'production'],
        default: 'development',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Create a simple project',
        command: 'gatekit projects create --name "My Project"',
      },
      {
        description: 'Create a project with description',
        command:
          'gatekit projects create --name "My Project" --description "A project for testing new features"',
      },
      {
        description: 'Create a production project',
        command:
          'gatekit projects create --name "My Project" --description "Production messaging service" --environment production',
      },
    ],
  })
  create(@Body() createProjectDto: CreateProjectDto, @Request() req: any) {
    // Handle both authentication types
    let ownerId: string;
    if (req.authType === 'api-key') {
      // For API key auth, use the owner of the project that the API key belongs to
      ownerId = req.project.owner.id;
    } else if (req.authType === 'jwt' && req.user?.user?.id) {
      // For JWT auth, use the authenticated user
      ownerId = req.user.user.id;
    } else {
      throw new Error(
        'Unable to determine user ID from authentication context',
      );
    }

    return this.projectsService.create(createProjectDto, ownerId);
  }

  @Get()
  @RequireScopes(ApiScope.PROJECTS_READ)
  @SdkContract({
    command: 'projects list',
    description: 'List all projects',
    category: 'Projects',
    requiredScopes: [ApiScope.PROJECTS_READ],
    outputType: 'ProjectResponse[]',
    examples: [
      {
        description: 'List all projects',
        command: 'gatekit projects list',
      },
    ],
  })
  findAll(@Request() req: any) {
    if (req.authType === 'jwt') {
      return this.projectsService.findAllForUser(
        req.user.user.id,
        req.user.user.isAdmin,
      );
    }
    // For API key authentication, return the single project associated with the key
    return [req.project];
  }

  @Get(':slug')
  @RequireScopes(ApiScope.PROJECTS_READ)
  @SdkContract({
    command: 'projects get',
    description: 'Get project details by slug',
    category: 'Projects',
    requiredScopes: [ApiScope.PROJECTS_READ],
    outputType: 'ProjectResponse',
    examples: [
      {
        description: 'Get project details',
        command: 'gatekit projects get my-project',
      },
    ],
  })
  findOne(@Param('slug') slug: string) {
    return this.projectsService.findOne(slug);
  }

  @Patch(':slug')
  @RequireScopes(ApiScope.PROJECTS_WRITE)
  @SdkContract({
    command: 'projects update',
    description: 'Update project name, description and settings',
    category: 'Projects',
    requiredScopes: [ApiScope.PROJECTS_WRITE],
    inputType: 'UpdateProjectDto',
    outputType: 'ProjectResponse',
    options: {
      name: { description: 'Project name', type: 'string' },
      description: { description: 'Project description', type: 'string' },
      environment: {
        description: 'Project environment',
        choices: ['development', 'staging', 'production'],
        type: 'string',
      },
      isDefault: { description: 'Set as default project', type: 'boolean' },
    },
    examples: [
      {
        description: 'Update project name',
        command: 'gatekit projects update my-project --name "New Project Name"',
      },
      {
        description: 'Update project description',
        command:
          'gatekit projects update my-project --description "Updated project description"',
      },
      {
        description: 'Update both name and description',
        command:
          'gatekit projects update my-project --name "New Name" --description "New description"',
      },
    ],
  })
  update(
    @Param('slug') slug: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(slug, updateProjectDto);
  }

  @Delete(':slug')
  @RequireScopes(ApiScope.PROJECTS_WRITE)
  @SdkContract({
    command: 'projects delete',
    description: 'Delete a project',
    category: 'Projects',
    requiredScopes: [ApiScope.PROJECTS_WRITE],
    outputType: 'MessageResponse',
    examples: [
      {
        description: 'Delete a project',
        command: 'gatekit projects delete my-project',
      },
    ],
  })
  remove(@Param('slug') slug: string, @Request() req: any) {
    if (req.authType === 'jwt') {
      return this.projectsService.remove(
        slug,
        req.user.user.id,
        req.user.user.isAdmin,
      );
    }
    // API key users cannot delete projects
    throw new Error('Project deletion not allowed with API key authentication');
  }
}

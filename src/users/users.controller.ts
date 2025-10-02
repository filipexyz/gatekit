import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { ApiScope } from '../common/enums/api-scopes.enum';

@Controller('api/v1/projects/:slug/members')
@UseGuards(AppAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireScopes(ApiScope.MEMBERS_READ)
  @SdkContract({
    command: 'members list',
    description: 'List all members of a project',
    category: 'Members',
    requiredScopes: [ApiScope.MEMBERS_READ],
    outputType: 'ProjectMemberResponse[]',
    examples: [
      {
        description: 'List all project members',
        command: 'gatekit members list my-project',
      },
    ],
  })
  async listMembers(@Param('slug') slug: string, @Request() req: any) {
    return this.usersService.getProjectMembers(slug, req.user.userId);
  }

  @Post()
  @RequireScopes(ApiScope.MEMBERS_WRITE)
  @SdkContract({
    command: 'members add',
    description: 'Add a member to a project',
    category: 'Members',
    requiredScopes: [ApiScope.MEMBERS_WRITE],
    inputType: 'AddMemberDto',
    outputType: 'ProjectMemberResponse',
    options: {
      email: {
        required: true,
        description: 'Email of user to add',
        type: 'string',
      },
      role: {
        required: true,
        description: 'Role to assign to the member',
        choices: ['owner', 'admin', 'member', 'viewer'],
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Add a member with admin role',
        command:
          'gatekit members add my-project --email user@example.com --role admin',
      },
      {
        description: 'Add a viewer to the project',
        command:
          'gatekit members add my-project --email viewer@example.com --role viewer',
      },
    ],
  })
  async addMember(
    @Param('slug') slug: string,
    @Body() dto: AddMemberDto,
    @Request() req: any,
  ) {
    return this.usersService.addProjectMember(
      slug,
      dto.email,
      dto.role,
      req.user.userId,
    );
  }

  @Patch(':userId')
  @RequireScopes(ApiScope.MEMBERS_WRITE)
  @SdkContract({
    command: 'members update',
    description: 'Update a member role in a project',
    category: 'Members',
    requiredScopes: [ApiScope.MEMBERS_WRITE],
    inputType: 'UpdateMemberRoleDto',
    outputType: 'ProjectMemberResponse',
    options: {
      userId: {
        required: true,
        description: 'User ID of the member to update',
        type: 'string',
      },
      role: {
        required: true,
        description: 'New role to assign',
        choices: ['admin', 'member', 'viewer'],
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Promote member to admin',
        command: 'gatekit members update my-project user-123 --role admin',
      },
      {
        description: 'Demote admin to member',
        command: 'gatekit members update my-project user-123 --role member',
      },
    ],
  })
  async updateMemberRole(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Request() req: any,
  ) {
    return this.usersService.updateProjectMemberRole(
      slug,
      userId,
      dto.role,
      req.user.userId,
    );
  }

  @Delete(':userId')
  @RequireScopes(ApiScope.MEMBERS_WRITE)
  @SdkContract({
    command: 'members remove',
    description: 'Remove a member from a project',
    category: 'Members',
    requiredScopes: [ApiScope.MEMBERS_WRITE],
    outputType: 'MessageResponse',
    options: {
      userId: {
        required: true,
        description: 'User ID of the member to remove',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Remove a member from project',
        command: 'gatekit members remove my-project user-123',
      },
    ],
  })
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.usersService.removeProjectMember(slug, userId, req.user.userId);
  }
}

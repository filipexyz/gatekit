import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { IdentitiesService } from './identities.service';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { AddAliasDto } from './dto/add-alias.dto';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { ProjectAccessGuard } from '../common/guards/project-access.guard';
import { AuthContextParam } from '../common/decorators/auth-context.decorator';
import type { AuthContext } from '../common/utils/security.util';
import { SdkContract } from '../common/decorators/sdk-contract.decorator';
import { RequireScopes } from '../common/decorators/scopes.decorator';
import {
  IdentityResponse,
  IdentityAliasResponse,
} from './dto/identity-response.dto';
import { ReceivedMessageResponse } from '../messages/dto/received-message-response.dto';
import { ReceivedReactionResponse } from '../messages/dto/received-reaction-response.dto';

@Controller('api/v1/projects/:projectSlug/identities')
@UseGuards(AppAuthGuard, ProjectAccessGuard)
export class IdentitiesController {
  constructor(private readonly identitiesService: IdentitiesService) {}

  @Post()
  @RequireScopes('identities:write')
  @SdkContract({
    command: 'identities create',
    description: 'Create a new identity with platform aliases',
    category: 'Identities',
    requiredScopes: ['identities:write'],
    inputType: 'CreateIdentityDto',
    outputType: 'IdentityResponse',
    options: {
      displayName: {
        description: 'Display name for the identity',
        type: 'string',
      },
      email: {
        description: 'Email address for the identity',
        type: 'string',
      },
      metadata: {
        description: 'JSON metadata for the identity',
        type: 'string',
      },
      aliases: {
        required: true,
        description: 'JSON array of platform aliases',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Create identity with Discord and Telegram aliases',
        command:
          'gatekit identities create --displayName "John Doe" --email "john@example.com" --aliases \'[{"platformId":"platform-123","providerUserId":"discord-456","providerUserDisplay":"JohnD#1234"}]\'',
      },
    ],
  })
  create(
    @Param('projectSlug') projectSlug: string,
    @Body() createIdentityDto: CreateIdentityDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.create(
      projectSlug,
      createIdentityDto,
      authContext,
    );
  }

  @Get()
  @RequireScopes('identities:read')
  @SdkContract({
    command: 'identities list',
    description: 'List all identities for a project',
    category: 'Identities',
    requiredScopes: ['identities:read'],
    outputType: 'IdentityResponse[]',
    examples: [
      {
        description: 'List all identities',
        command: 'gatekit identities list',
      },
    ],
  })
  findAll(
    @Param('projectSlug') projectSlug: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.findAll(projectSlug, authContext);
  }

  @Get('lookup')
  @RequireScopes('identities:read')
  @SdkContract({
    command: 'identities lookup',
    description: 'Lookup identity by platform user ID',
    category: 'Identities',
    requiredScopes: ['identities:read'],
    outputType: 'IdentityResponse',
    options: {
      platformId: {
        required: true,
        description: 'Platform configuration ID',
        type: 'string',
      },
      providerUserId: {
        required: true,
        description: 'Provider-specific user ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Lookup identity by Discord user',
        command:
          'gatekit identities lookup --platformId platform-123 --providerUserId discord-456',
      },
    ],
  })
  lookup(
    @Param('projectSlug') projectSlug: string,
    @Query('platformId') platformId: string,
    @Query('providerUserId') providerUserId: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.lookupByPlatformUser(
      projectSlug,
      platformId,
      providerUserId,
      authContext,
    );
  }

  @Get(':id')
  @RequireScopes('identities:read')
  @SdkContract({
    command: 'identities get',
    description: 'Get a specific identity by ID',
    category: 'Identities',
    requiredScopes: ['identities:read'],
    outputType: 'IdentityResponse',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Get identity details',
        command: 'gatekit identities get identity-123',
      },
    ],
  })
  findOne(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.findOne(projectSlug, id, authContext);
  }

  @Patch(':id')
  @RequireScopes('identities:write')
  @SdkContract({
    command: 'identities update',
    description: 'Update identity metadata (display name, email, metadata)',
    category: 'Identities',
    requiredScopes: ['identities:write'],
    inputType: 'UpdateIdentityDto',
    outputType: 'IdentityResponse',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
      displayName: {
        description: 'Updated display name',
        type: 'string',
      },
      email: {
        description: 'Updated email address',
        type: 'string',
      },
      metadata: {
        description: 'Updated JSON metadata',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Update identity display name',
        command:
          'gatekit identities update identity-123 --displayName "Jane Doe"',
      },
      {
        description: 'Update identity email and metadata',
        command:
          'gatekit identities update identity-123 --email "jane@example.com" --metadata \'{"tier":"premium"}\'',
      },
    ],
  })
  update(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @Body() updateIdentityDto: UpdateIdentityDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.update(
      projectSlug,
      id,
      updateIdentityDto,
      authContext,
    );
  }

  @Post(':id/aliases')
  @RequireScopes('identities:write')
  @SdkContract({
    command: 'identities add-alias',
    description: 'Add a platform alias to an existing identity',
    category: 'Identities',
    requiredScopes: ['identities:write'],
    inputType: 'AddAliasDto',
    outputType: 'IdentityAliasResponse',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
      platformId: {
        required: true,
        description: 'Platform configuration ID',
        type: 'string',
      },
      providerUserId: {
        required: true,
        description: 'Provider-specific user ID',
        type: 'string',
      },
      providerUserDisplay: {
        description: 'Display name on the platform',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Link WhatsApp account to existing identity',
        command:
          'gatekit identities add-alias identity-123 --platformId platform-789 --providerUserId "+1234567890" --providerUserDisplay "John Mobile"',
      },
    ],
  })
  addAlias(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @Body() addAliasDto: AddAliasDto,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.addAlias(
      projectSlug,
      id,
      addAliasDto,
      authContext,
    );
  }

  @Delete(':id/aliases/:aliasId')
  @RequireScopes('identities:write')
  @SdkContract({
    command: 'identities remove-alias',
    description: 'Remove a platform alias from an identity',
    category: 'Identities',
    requiredScopes: ['identities:write'],
    outputType: 'MessageResponse',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
      aliasId: {
        required: true,
        description: 'Alias ID to remove',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Unlink platform account from identity',
        command: 'gatekit identities remove-alias identity-123 alias-456',
      },
    ],
  })
  removeAlias(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @Param('aliasId') aliasId: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.removeAlias(
      projectSlug,
      id,
      aliasId,
      authContext,
    );
  }

  @Delete(':id')
  @RequireScopes('identities:write')
  @SdkContract({
    command: 'identities delete',
    description: 'Delete an identity and all its aliases',
    category: 'Identities',
    requiredScopes: ['identities:write'],
    outputType: 'MessageResponse',
    options: {
      id: {
        required: true,
        description: 'Identity ID to delete',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Delete an identity',
        command: 'gatekit identities delete identity-123',
      },
    ],
  })
  remove(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.remove(projectSlug, id, authContext);
  }

  @Get(':id/messages')
  @RequireScopes('identities:read', 'messages:read')
  @SdkContract({
    command: 'identities messages',
    description:
      'Get all messages for an identity (across all linked platform accounts)',
    category: 'Identities',
    requiredScopes: ['identities:read', 'messages:read'],
    outputType: 'ReceivedMessageResponse[]',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Get all messages for an identity',
        command: 'gatekit identities messages identity-123',
      },
    ],
  })
  getMessages(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.getMessagesForIdentity(
      projectSlug,
      id,
      authContext,
    );
  }

  @Get(':id/reactions')
  @RequireScopes('identities:read', 'messages:read')
  @SdkContract({
    command: 'identities reactions',
    description:
      'Get all reactions for an identity (across all linked platform accounts)',
    category: 'Identities',
    requiredScopes: ['identities:read', 'messages:read'],
    outputType: 'ReceivedReactionResponse[]',
    options: {
      id: {
        required: true,
        description: 'Identity ID',
        type: 'string',
      },
    },
    examples: [
      {
        description: 'Get all reactions for an identity',
        command: 'gatekit identities reactions identity-123',
      },
    ],
  })
  getReactions(
    @Param('projectSlug') projectSlug: string,
    @Param('id') id: string,
    @AuthContextParam() authContext: AuthContext,
  ) {
    return this.identitiesService.getReactionsForIdentity(
      projectSlug,
      id,
      authContext,
    );
  }
}

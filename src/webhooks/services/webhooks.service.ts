import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityUtil, AuthContext } from '../../common/utils/security.util';
import { UrlValidationUtil } from '../../common/utils/url-validation.util';
import { CreateWebhookDto } from '../dto/create-webhook.dto';
import { UpdateWebhookDto } from '../dto/update-webhook.dto';
import { QueryDeliveriesDto } from '../dto/query-deliveries.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly MAX_WEBHOOKS_PER_PROJECT = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Create a new webhook
   */
  async createWebhook(
    projectId: string,
    dto: CreateWebhookDto,
    authContext: AuthContext,
  ) {
    // Validate project access
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook creation',
    );

    // Check webhook limit
    const webhookCount = await this.prisma.webhook.count({
      where: { projectId: project.id },
    });

    if (webhookCount >= this.MAX_WEBHOOKS_PER_PROJECT) {
      throw new BadRequestException(
        `Maximum ${this.MAX_WEBHOOKS_PER_PROJECT} webhooks per project allowed`,
      );
    }

    // SECURITY: Validate webhook URL against SSRF attacks
    await UrlValidationUtil.validateUrl(dto.url, 'webhook URL');

    // Generate secret if not provided
    const secret =
      dto.secret || `whsec_${crypto.randomBytes(32).toString('hex')}`;

    const webhook = await this.prisma.webhook.create({
      data: {
        projectId: project.id,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret,
      },
    });

    return {
      ...webhook,
      secret, // Show secret only on creation
      message: dto.secret
        ? 'Webhook created with your custom secret'
        : 'Save your webhook secret - it will not be shown again',
    };
  }

  /**
   * List all webhooks for a project
   */
  async listWebhooks(projectId: string, authContext: AuthContext) {
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook listing',
    );

    const webhooks = await this.prisma.webhook.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        secret: true, // Will be masked in response
      },
    });

    // Mask secrets in list view
    return webhooks.map((webhook) => ({
      ...webhook,
      secret: this.maskSecret(webhook.secret),
    }));
  }

  /**
   * Get a specific webhook
   */
  async getWebhook(
    projectId: string,
    webhookId: string,
    authContext: AuthContext,
  ) {
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook retrieval',
    );

    const webhook = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId: project.id,
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Get delivery stats
    const stats = await this.webhookDeliveryService.getDeliveryStats(
      webhook.id,
    );

    return {
      ...webhook,
      secret: this.maskSecret(webhook.secret),
      stats,
    };
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    projectId: string,
    webhookId: string,
    dto: UpdateWebhookDto,
    authContext: AuthContext,
  ) {
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook update',
    );

    // Verify webhook exists and belongs to project
    const existing = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId: project.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Webhook not found');
    }

    // SECURITY: Validate new webhook URL against SSRF attacks (if URL is being updated)
    if (dto.url) {
      await UrlValidationUtil.validateUrl(dto.url, 'webhook URL');
    }

    const webhook = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: dto,
    });

    return {
      ...webhook,
      secret: this.maskSecret(webhook.secret),
    };
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(
    projectId: string,
    webhookId: string,
    authContext: AuthContext,
  ) {
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook deletion',
    );

    // Verify webhook exists and belongs to project
    const existing = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId: project.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.webhook.delete({
      where: { id: webhookId },
    });

    return {
      message: 'Webhook deleted successfully',
      id: webhookId,
    };
  }

  /**
   * Get webhook deliveries with filtering
   */
  async getDeliveries(
    projectId: string,
    webhookId: string,
    query: QueryDeliveriesDto,
    authContext: AuthContext,
  ) {
    const project = await SecurityUtil.getProjectWithAccess(
      this.prisma,
      projectId,
      authContext,
      'webhook delivery retrieval',
    );

    // Verify webhook belongs to project
    const webhook = await this.prisma.webhook.findFirst({
      where: {
        id: webhookId,
        projectId: project.id,
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Build where clause
    const where: {
      webhookId: string;
      event?: string;
      status?: string;
    } = { webhookId };

    if (query.event) {
      where.event = query.event;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Get deliveries with pagination
    const [deliveries, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          event: true,
          status: true,
          responseCode: true,
          error: true,
          attempts: true,
          deliveredAt: true,
          createdAt: true,
          payload: true,
        },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      deliveries,
      pagination: {
        total,
        limit: query.limit!,
        offset: query.offset!,
        hasMore: query.offset! + query.limit! < total,
      },
    };
  }

  /**
   * Mask webhook secret for display (show only prefix)
   */
  private maskSecret(secret: string): string {
    if (secret.length <= 12) return '********';
    return `${secret.substring(0, 12)}...`;
  }
}

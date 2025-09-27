import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Logger,
  All,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlatformRegistry } from '../services/platform-registry.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/v1/webhooks')
export class DynamicWebhookController {
  private readonly logger = new Logger(DynamicWebhookController.name);

  constructor(private readonly platformRegistry: PlatformRegistry) {}

  /**
   * Dynamic webhook handler that routes to the appropriate platform provider
   * This single endpoint handles all platform webhooks dynamically
   */
  @Public()
  @All(':platform/:webhookToken')
  async handleWebhook(
    @Param('platform') platform: string,
    @Param('webhookToken') webhookToken: string,
    @Body() body: any,
    @Headers() headers: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.logger.log(
      `🔔 WEBHOOK RECEIVED! Platform: ${platform}, Method: ${req.method}, IP: ${req.ip}`,
    );
    this.logger.log(`🎯 Webhook token: ${webhookToken.substring(0, 8)}...`);
    this.logger.log(`📨 Body size: ${JSON.stringify(body).length} bytes`);
    this.logger.log(
      `🔗 Headers: User-Agent: ${headers['user-agent'] || 'none'}`,
    );
    this.logger.log(
      `📍 Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`,
    );

    // Get the platform provider
    const provider = this.platformRegistry.getProvider(platform);

    if (!provider) {
      this.logger.warn(`Unknown platform: ${platform}`);
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Platform not found',
      });
    }

    // Check if this platform supports webhooks
    if (provider.connectionType !== 'webhook') {
      this.logger.warn(
        `Platform ${platform} does not support webhooks (type: ${provider.connectionType})`,
      );
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Platform does not support webhooks',
      });
    }

    if (!provider.getWebhookConfig) {
      this.logger.error(
        `Platform ${platform} has webhook type but no webhook config`,
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Platform webhook configuration missing',
      });
    }

    try {
      // Get the webhook configuration and handler from the provider
      const config = provider.getWebhookConfig();

      // Execute the platform-specific webhook handler
      const result = await config.handler(
        { platform, webhookToken },
        body,
        headers,
      );

      // Return the result
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(
        `Webhook handler error for ${platform}: ${error.message}`,
        error.stack,
      );

      // Check for specific error types
      if (error.name === 'NotFoundException') {
        return res.status(HttpStatus.NOT_FOUND).json({
          error: error.message,
        });
      }

      if (error.name === 'UnauthorizedException') {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          error: error.message,
        });
      }

      if (error.name === 'BadRequestException') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: error.message,
        });
      }

      // Generic error
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Webhook processing failed',
      });
    }
  }

  /**
   * Health check endpoint for webhooks
   */
  @Public()
  @Post('health')
  async webhookHealth() {
    const providers = this.platformRegistry.getAllProviders();
    const webhookProviders = providers.filter(
      (p) => p.connectionType === 'webhook',
    );

    return {
      status: 'healthy',
      webhookProviders: webhookProviders.map((p) => ({
        name: p.name,
        displayName: p.displayName,
      })),
      count: webhookProviders.length,
    };
  }
}

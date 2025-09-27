import { Controller, Get, Logger } from '@nestjs/common';
import { PlatformRegistry } from '../services/platform-registry.service';

@Controller('api/v1/platforms')
export class PlatformHealthController {
  private readonly logger = new Logger(PlatformHealthController.name);

  constructor(private readonly platformRegistry: PlatformRegistry) {}

  /**
   * Get health status for all registered platform providers
   */
  @Get('health')
  async getHealth() {
    const providers = this.platformRegistry.getAllProviders();
    const healthStatus = await this.platformRegistry.getHealthStatus();

    const platformsInfo = providers.map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
      connectionType: provider.connectionType,
      isHealthy: healthStatus[provider.name] || false,
      stats: provider.getConnectionStats ? provider.getConnectionStats() : null,
    }));

    return {
      status: 'ok',
      totalProviders: providers.length,
      healthyProviders: Object.values(healthStatus).filter(Boolean).length,
      platforms: platformsInfo,
      supportedPlatforms: this.platformRegistry.getSupportedPlatforms(),
    };
  }

  /**
   * Get supported platforms list
   */
  @Get('supported')
  getSupportedPlatforms() {
    const providers = this.platformRegistry.getAllProviders();

    return {
      platforms: providers.map((provider) => ({
        name: provider.name,
        displayName: provider.displayName,
        connectionType: provider.connectionType,
        features: {
          supportsWebhooks: provider.connectionType === 'webhook',
          supportsPolling: provider.connectionType === 'polling',
          supportsWebSocket: provider.connectionType === 'websocket',
        },
      })),
    };
  }

  /**
   * Get webhook routes for platforms that support webhooks
   */
  @Get('webhook-routes')
  getWebhookRoutes() {
    const routes = this.platformRegistry.getWebhookRoutes();

    return {
      routes: routes.map((route) => ({
        platform: route.platform,
        path: `/api/v1/webhooks/${route.platform}/:webhookToken`,
        method: 'POST',
      })),
    };
  }
}
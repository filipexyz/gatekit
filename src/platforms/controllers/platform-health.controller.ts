import { Controller, Get, Logger } from '@nestjs/common';
import { PlatformRegistry } from '../services/platform-registry.service';
import { CredentialValidationService } from '../services/credential-validation.service';
import { SdkContract } from '../../common/decorators/sdk-contract.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { SupportedPlatformsResponse } from '../../common/types/api-responses';

@Controller('api/v1/platforms')
export class PlatformHealthController {
  private readonly logger = new Logger(PlatformHealthController.name);

  constructor(
    private readonly platformRegistry: PlatformRegistry,
    private readonly credentialValidation: CredentialValidationService,
  ) {}

  /**
   * Get health status for all registered platform providers
   */
  @Get('health')
  @Public()
  async getHealth() {
    const providers = this.platformRegistry.getAllProviders();
    const healthStatus = await this.platformRegistry.getHealthStatus();

    const platformsInfo = providers.map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
      connectionType: provider.connectionType,
      isHealthy: healthStatus[provider.name] || false,
      stats: provider.getConnectionStats ? provider.getConnectionStats() : null,
      capabilities: this.platformRegistry.getProviderCapabilities(provider),
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
  @Public()
  @SdkContract({
    command: 'platforms supported',
    description: 'List supported platforms with credential requirements',
    category: 'Platforms',
    requiredScopes: [],
    outputType: 'SupportedPlatformsResponse',
    examples: [
      {
        description: 'List supported platforms',
        command: 'gatekit platforms supported',
      },
    ],
  })
  getSupportedPlatforms(): SupportedPlatformsResponse {
    const providers = this.platformRegistry.getAllProviders();

    return {
      platforms: providers.map((provider) => {
        const credentialSchema = this.credentialValidation.getValidationSchema(
          provider.name,
        );

        return {
          name: provider.name,
          displayName: provider.displayName,
          connectionType: provider.connectionType,
          features: {
            supportsWebhooks: provider.connectionType === 'webhook',
            supportsPolling: provider.connectionType === 'polling',
            supportsWebSocket: provider.connectionType === 'websocket',
          },
          credentials: credentialSchema
            ? {
                required: credentialSchema.required,
                optional: credentialSchema.optional,
                example: credentialSchema.example,
              }
            : null,
        };
      }),
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

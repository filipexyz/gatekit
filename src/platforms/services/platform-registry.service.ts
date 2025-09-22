import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlatformProvider } from '../interfaces/platform-provider.interface';
import { ModuleRef, DiscoveryService } from '@nestjs/core';
import { PLATFORM_PROVIDER_METADATA } from '../decorators/platform-provider.decorator';

@Injectable()
export class PlatformRegistry implements OnModuleInit {
  private readonly logger = new Logger(PlatformRegistry.name);
  private readonly providers = new Map<string, PlatformProvider>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
  ) {}

  async onModuleInit() {
    await this.discoverAndRegisterProviders();
  }

  private async discoverAndRegisterProviders() {
    this.logger.log('Auto-discovering platform providers...');

    // Get all providers with our decorator
    const providers = this.discoveryService
      .getProviders()
      .filter((wrapper) => {
        try {
          return wrapper.metatype && Reflect.getMetadata(PLATFORM_PROVIDER_METADATA, wrapper.metatype);
        } catch {
          return false;
        }
      });

    // Register each discovered provider
    for (const wrapper of providers) {
      try {
        const instance = this.moduleRef.get(wrapper.token, { strict: false });

        if (instance && this.isPlatformProvider(instance)) {
          await instance.initialize();
          this.register(instance);
          this.logger.log(`Auto-registered platform: ${instance.displayName}`);
        }
      } catch (error) {
        this.logger.error(`Failed to register provider ${wrapper.name}: ${error.message}`);
      }
    }

    this.logger.log(`Discovered and registered ${this.providers.size} platform providers`);
  }

  private isPlatformProvider(instance: any): instance is PlatformProvider {
    return (
      typeof instance.name === 'string' &&
      typeof instance.displayName === 'string' &&
      typeof instance.connectionType === 'string' &&
      typeof instance.createAdapter === 'function' &&
      typeof instance.initialize === 'function' &&
      typeof instance.shutdown === 'function'
    );
  }

  register(provider: PlatformProvider) {
    const name = provider.name.toLowerCase();
    if (this.providers.has(name)) {
      this.logger.warn(`Platform provider '${name}' is already registered, overwriting...`);
    }

    this.providers.set(name, provider);
    this.logger.log(`Registered platform provider: ${provider.displayName} (${provider.connectionType})`);
  }

  unregister(platformName: string) {
    const name = platformName.toLowerCase();
    if (this.providers.delete(name)) {
      this.logger.log(`Unregistered platform provider: ${name}`);
    }
  }

  getProvider(platformName: string): PlatformProvider | undefined {
    return this.providers.get(platformName.toLowerCase());
  }

  getAllProviders(): PlatformProvider[] {
    return Array.from(this.providers.values());
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.providers.keys());
  }

  async getHealthStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        status[name] = await provider.isHealthy();
      } catch (error) {
        this.logger.error(`Health check failed for ${name}: ${error.message}`);
        status[name] = false;
      }
    }

    return status;
  }

  getWebhookRoutes(): Array<{ platform: string; config: any }> {
    const routes: Array<{ platform: string; config: any }> = [];

    for (const [name, provider] of this.providers) {
      if (provider.connectionType === 'webhook' && provider.getWebhookConfig) {
        const config = provider.getWebhookConfig();
        routes.push({ platform: name, config });
      }
    }

    return routes;
  }
}
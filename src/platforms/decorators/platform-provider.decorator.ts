import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PROVIDER_METADATA = 'platform_provider';

/**
 * Decorator to mark a class as a platform provider
 * This enables automatic discovery and registration
 *
 * @param name - The unique name of the platform (e.g., 'discord', 'telegram')
 */
export const PlatformProviderDecorator = (name: string) =>
  SetMetadata(PLATFORM_PROVIDER_METADATA, { name });
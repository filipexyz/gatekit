import { SetMetadata } from '@nestjs/common';
import { PlatformCapability } from '../enums/platform-capability.enum';

export const PLATFORM_PROVIDER_METADATA = 'platform_provider';
export const PLATFORM_CAPABILITIES_METADATA = 'platform_capabilities';

export interface PlatformCapabilityInfo {
  capability: PlatformCapability;
  limitations?: string; // Simple string like "15 minutes" or "48 hours"
}

/**
 * Decorator to mark a class as a platform provider with capabilities
 * This enables automatic discovery and registration
 *
 * @param name - The unique name of the platform (e.g., 'discord', 'telegram')
 * @param capabilities - Array of capabilities supported by this platform
 */
export const PlatformProviderDecorator = (
  name: string,
  capabilities: PlatformCapabilityInfo[] = [],
) => {
  return (target: any) => {
    SetMetadata(PLATFORM_PROVIDER_METADATA, { name })(target);
    SetMetadata(PLATFORM_CAPABILITIES_METADATA, capabilities)(target);
  };
};

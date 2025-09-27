import { SetMetadata } from '@nestjs/common';

export const SDK_TYPE_KEY = 'sdk-type';

export interface SdkTypeMetadata {
  name: string;
  essential?: boolean; // Mark as essential for SDK generation
}

/**
 * Decorator to mark types for inclusion in SDK generation
 * Use this on type definitions that should be included in the generated SDK
 */
export const SdkType = (metadata: SdkTypeMetadata) =>
  SetMetadata(SDK_TYPE_KEY, metadata);

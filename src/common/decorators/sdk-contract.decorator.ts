import { SetMetadata } from '@nestjs/common';

export const SDK_CONTRACT_KEY = 'sdk-contract';

export interface SdkContractOption {
  required?: boolean;
  description?: string;
  choices?: string[];
  default?: unknown;
  type?: 'string' | 'number' | 'boolean';
}

export interface SdkContractMetadata {
  command: string;
  description: string;
  category?: string;
  requiredScopes?: string[];
  options?: Record<string, SdkContractOption>;
  examples?: Array<{
    description: string;
    command: string;
  }>;
}

export const SdkContract = (metadata: SdkContractMetadata) =>
  SetMetadata(SDK_CONTRACT_KEY, metadata);
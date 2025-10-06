import { SetMetadata } from '@nestjs/common';

export const SDK_CONTRACT_KEY = 'sdk-contract';

export interface SdkContractOption {
  required?: boolean;
  description?: string;
  choices?: string[];
  default?: unknown;
  type?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'object'
    | 'array'
    | 'target_pattern'
    | 'targets_pattern';
}

export interface SdkContractMetadata {
  command: string;
  description: string;
  category?: string;
  requiredScopes?: string[];
  inputType?: string; // Reference to backend DTO class name
  outputType?: string; // Reference to backend model/response type
  options?: Record<string, SdkContractOption>;
  examples?: Array<{
    description: string;
    command: string;
  }>;
  excludeFromMcp?: boolean; // Exclude this endpoint from MCP tool exposure
}

export const SdkContract = (metadata: SdkContractMetadata) =>
  SetMetadata(SDK_CONTRACT_KEY, metadata);

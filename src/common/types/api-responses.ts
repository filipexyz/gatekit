// API Response Types for SDK Generation
// These types match the exact return objects from service methods

export interface PlatformResponse {
  id: string;
  platform: string;
  isActive: boolean;
  testMode: boolean;
  webhookUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageSendResponse {
  success: boolean;
  jobId: string;
  status: string;
  targets: Array<{
    platformId: string;
    type: string;
    id: string;
  }>;
  platformIds: string[];
  timestamp: string;
  message: string;
}

export interface MessageStatusResponse {
  jobId: string;
  status: string;
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface MessageRetryResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyListResponse {
  id: string;
  name: string;
  maskedKey: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyRollResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
  oldKeyRevokedAt: Date;
}

export interface MessageResponse {
  message: string;
}
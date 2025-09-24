// SDK Model Interfaces - Clean types based on actual API responses
// These interfaces represent what the API actually returns to clients

// Enums
export type ProjectEnvironment = 'development' | 'staging' | 'production';
export type PlatformType = 'discord' | 'telegram';

export interface Project {
  id: string;
  name: string;
  slug: string;
  environment: 'development' | 'staging' | 'production';
  isDefault: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _count?: {
    apiKeys: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Platform {
  id: string;
  platform: 'discord' | 'telegram';
  isActive: boolean;
  testMode: boolean;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  targets: Array<{
    platformId: string;
    type: 'user' | 'channel' | 'group';
    id: string;
  }>;
  message: string;
  timestamp: string;
}

export interface MessageStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  data?: {
    projectSlug: string;
    projectId: string;
    message: any;
    error?: string;
  };
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
}

// Update DTOs (simplified versions of backend DTOs)
export interface UpdatePlatformDto {
  isActive?: boolean;
  testMode?: boolean;
  credentials?: Record<string, unknown>;
}

// Message nested types (from SendMessageDto)
export interface TargetDto {
  platformId: string;
  type: 'user' | 'channel' | 'group';
  id: string;
}

export interface ContentDto {
  text?: string;
  attachments?: any[];
  buttons?: any[];
  embeds?: any[];
}

export interface OptionsDto {
  replyTo?: string;
  silent?: boolean;
  scheduled?: string;
}

export interface MetadataDto {
  trackingId?: string;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}
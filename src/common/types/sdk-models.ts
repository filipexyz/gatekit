// SDK Model Interfaces - Clean types based on actual API responses
// These interfaces represent what the API actually returns to clients

// Enums
export type ProjectEnvironment = 'development' | 'staging' | 'production';
export type PlatformType = 'discord' | 'telegram';
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Project {
  id: string;
  name: string;
  description?: string;
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
  name?: string;
  description?: string;
  isActive?: boolean;
  testMode?: boolean;
  credentials?: Record<string, unknown>;
}

// User and Project Member DTOs
export interface User {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface AddMemberDto {
  email: string;
  role: ProjectRole;
}

export interface UpdateMemberRoleDto {
  role: ProjectRole;
}

// Platform Logs DTOs and Responses
export interface PlatformLog {
  id: string;
  projectId: string;
  platformId?: string;
  platform: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'connection' | 'webhook' | 'message' | 'error' | 'auth' | 'general';
  message: string;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: string;
  platformConfig?: {
    id: string;
    platform: string;
    isActive: boolean;
  };
}

export interface PlatformLogsResponse {
  logs: PlatformLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface PlatformLogStatsResponse {
  summary: Array<{
    level: string;
    category: string;
    count: number;
  }>;
  recentErrors: Array<{
    message: string;
    category: string;
    timestamp: string;
    platform: string;
  }>;
}

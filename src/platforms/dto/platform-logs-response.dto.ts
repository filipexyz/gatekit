export class PlatformLogResponse {
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

export class PlatformLogsResponse {
  logs: PlatformLogResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

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

export interface ReceivedMessage {
  id: string;
  platform: string;
  providerMessageId: string;
  providerChatId: string;
  providerUserId: string;
  userDisplay: string | null;
  messageText: string | null;
  messageType: string;
  receivedAt: Date;
  rawData: any;
  platformConfig?: {
    id: string;
    platform: string;
    isActive: boolean;
    testMode: boolean;
  };
}

export interface MessageListResponse {
  messages: ReceivedMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface MessageStatsResponse {
  received: {
    totalMessages: number;
    recentMessages: number;
    uniqueUsers: number;
    uniqueChats: number;
    byPlatform: Array<{
      platform: string;
      count: number;
    }>;
  };
  sent: {
    totalMessages: number;
    byPlatformAndStatus: Array<{
      platform: string;
      status: string;
      count: number;
    }>;
  };
}

export interface SentMessage {
  id: string;
  platform: string;
  jobId: string | null;
  providerMessageId: string | null;
  targetChatId: string;
  targetUserId: string | null;
  targetType: string;
  messageText: string | null;
  messageContent: any | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}
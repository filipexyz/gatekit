export class MessageStatsResponse {
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

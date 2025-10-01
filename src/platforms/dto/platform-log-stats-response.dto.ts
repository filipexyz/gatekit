export class PlatformLogStatsResponse {
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

export class QueryPlatformLogsDto {
  platform?: string;
  level?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

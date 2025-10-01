export interface QueryMessagesDto {
  platform?: string;
  platformId?: string;
  chatId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  raw?: boolean;
  reactions?: boolean;
}

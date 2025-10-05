import { SentMessageResponse } from './sent-message-response.dto';

export class SentMessageListResponse {
  messages: SentMessageResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

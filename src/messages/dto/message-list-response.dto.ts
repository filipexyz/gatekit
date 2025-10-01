import { ReceivedMessageResponse } from './received-message-response.dto';

export class MessageListResponse {
  messages: ReceivedMessageResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

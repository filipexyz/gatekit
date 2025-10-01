export class ReceivedMessageResponse {
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

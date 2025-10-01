export class SentMessageResponse {
  id: string;
  platform: string;
  jobId: string | null;
  providerMessageId: string | null;
  targetChatId: string;
  targetUserId: string | null;
  targetType: string;
  messageText: string | null;
  messageContent: Record<string, unknown> | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

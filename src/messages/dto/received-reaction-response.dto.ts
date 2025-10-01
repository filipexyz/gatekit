/**
 * Received reaction response DTO for API contracts
 * Represents a reaction (emoji) received on a message
 */
export class ReceivedReactionResponse {
  id: string;
  projectId: string;
  platformId: string;
  platform: string;
  providerMessageId: string;
  providerChatId: string;
  providerUserId: string;
  userDisplay: string | null;
  emoji: string;
  reactionType: 'added' | 'removed';
  rawData: Record<string, any>;
  receivedAt: Date;
}

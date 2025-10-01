export enum WebhookEventType {
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_FAILED = 'message.failed',
  BUTTON_CLICKED = 'button.clicked',
  REACTION_ADDED = 'reaction.added',
  REACTION_REMOVED = 'reaction.removed',
}

/**
 * Webhook payload structure
 *
 * NOTE: This uses a union type for data to support all event types.
 * For stricter type checking in webhook receivers, consider using discriminated unions:
 *
 * type StrictWebhookPayload =
 *   | { event: WebhookEventType.MESSAGE_RECEIVED; data: MessageReceivedData }
 *   | { event: WebhookEventType.MESSAGE_SENT; data: MessageSentData }
 *   | { event: WebhookEventType.MESSAGE_FAILED; data: MessageFailedData }
 *   | { event: WebhookEventType.BUTTON_CLICKED; data: ButtonClickedData }
 *   | { event: WebhookEventType.REACTION_ADDED; data: ReactionAddedData }
 *   | { event: WebhookEventType.REACTION_REMOVED; data: ReactionRemovedData }
 *
 * This allows TypeScript to narrow the data type based on the event field.
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  project_id: string;
  data:
    | MessageReceivedData
    | MessageSentData
    | MessageFailedData
    | ButtonClickedData
    | ReactionAddedData
    | ReactionRemovedData;
}

export interface MessageReceivedData {
  message_id: string;
  platform: string;
  platform_id: string;
  chat_id: string;
  user_id: string;
  user_display: string | null;
  text: string | null;
  message_type: string;
  received_at: string;
  raw?: Record<string, unknown>; // Optional raw platform data
}

export interface MessageSentData {
  message_id: string;
  job_id: string | null;
  platform: string;
  platform_id: string;
  target: {
    type: string;
    chat_id: string;
    user_id: string | null;
  };
  text: string | null;
  sent_at: string;
}

export interface MessageFailedData {
  job_id: string;
  platform: string;
  platform_id: string;
  target: {
    type: string;
    chat_id: string;
  };
  error: string;
  failed_at: string;
}

export interface ButtonClickedData {
  message_id: string;
  platform: string;
  platform_id: string;
  chat_id: string;
  user_id: string;
  user_display: string | null;
  button_value: string;
  clicked_at: string;
  raw?: Record<string, unknown>; // Optional raw platform data
}

export interface ReactionAddedData {
  message_id: string;
  platform: string;
  platform_id: string;
  chat_id: string;
  user_id: string;
  user_display: string | null;
  emoji: string;
  timestamp: string;
  raw?: Record<string, unknown>; // Optional raw platform data
}

export interface ReactionRemovedData {
  message_id: string;
  platform: string;
  platform_id: string;
  chat_id: string;
  user_id: string;
  user_display: string | null;
  emoji: string;
  timestamp: string;
  raw?: Record<string, unknown>; // Optional raw platform data
}

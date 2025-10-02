import { PlatformType } from '../../common/enums/platform-type.enum';

export type ChannelType = PlatformType;

export interface UserRef {
  providerUserId: string;
  display?: string;
  globalUserId?: string;
}

export interface MessageContent {
  text?: string;
  attachments?: Array<{
    id?: string;
    url?: string;
    mime?: string;
    size?: number;
    name?: string;
  }>;
  locale?: string;
}

export interface MessageEnvelopeV1 {
  version: '1';
  id: string;
  ts: number;
  channel: ChannelType;
  projectId: string;
  threadId?: string;
  user: UserRef;
  message: MessageContent;
  action?: {
    type: 'command' | 'button' | 'menu';
    value: string;
  } | null;
  provider: {
    eventId?: string;
    raw?: unknown;
  };
  context?: Record<string, unknown>;
}

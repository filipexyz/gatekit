import { MessageEnvelopeV1 } from './message-envelope.interface';
import { PlatformType } from '../../common/enums/platform-type.enum';

export interface InboundEventSource {
  start(): Promise<void>;
  stop?(): Promise<void>;
}

export interface OutboundTransport {
  sendMessage(
    env: MessageEnvelopeV1,
    reply: {
      text?: string;
      attachments?: any[];
      buttons?: any[];
      embeds?: any[];
      threadId?: string;
      replyTo?: string;
      silent?: boolean;
    },
  ): Promise<{ providerMessageId: string }>;
}

export interface PlatformAdapter extends InboundEventSource, OutboundTransport {
  readonly channel: PlatformType;
  initialize(projectId: string, credentials: any): Promise<void>;
  validateSignature?(req: any): boolean;
  toEnvelope(providerPayload: any, projectId?: string): MessageEnvelopeV1;
}

export const PLATFORM_ADAPTER = Symbol('PLATFORM_ADAPTER');

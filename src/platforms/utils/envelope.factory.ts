import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';
import { randomUUID } from 'crypto';

export function makeEnvelope(
  partial: Omit<MessageEnvelopeV1, 'version' | 'id' | 'ts'>,
): MessageEnvelopeV1 {
  return {
    version: '1',
    id: randomUUID(),
    ts: Date.now(),
    ...partial,
  };
}

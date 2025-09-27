import { MessageEnvelopeV1 } from './message-envelope.interface';

export interface IEventBus {
  publish(envelope: MessageEnvelopeV1): Promise<void>;
  subscribe(handler: (envelope: MessageEnvelopeV1) => Promise<void>): void;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

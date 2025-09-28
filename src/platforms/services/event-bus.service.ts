import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventBus } from '../interfaces/event-bus.interface';
import { MessageEnvelopeV1 } from '../interfaces/message-envelope.interface';

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(envelope: MessageEnvelopeV1): Promise<void> {
    this.logger.debug(
      `Publishing message from ${envelope.channel}: ${envelope.id}`,
    );
    this.eventEmitter.emit('message.received', envelope);
  }

  subscribe(handler: (envelope: MessageEnvelopeV1) => Promise<void>): void {
    this.eventEmitter.on('message.received', (envelope) => {
      void handler(envelope);
    });
  }
}

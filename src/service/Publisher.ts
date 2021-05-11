import { DefaultPubSub } from '@nestjs/cqrs/dist/helpers/default-pubsub';
import { toEventName } from '../utils';
import { PubsubEvent } from '../interface';
import type { Subject } from 'rxjs';
import type { IEvent } from '@nestjs/cqrs';
import type { Producer } from './Producer';

export class Publisher<EventBase extends IEvent> extends DefaultPubSub<EventBase> {
    constructor(subject$: Subject<EventBase>, readonly producer: Producer) {
        super(subject$);
    }

    async publish<T extends EventBase>(event: T): Promise<void> {
        if (event instanceof PubsubEvent) {
            event.localEventEnabled() && super.publish(event);
            return this.producer.produce(toEventName(event.constructor.name), event.payload(), event.exchange(), event.getOptions());
        }

        return super.publish(event);
    }
}

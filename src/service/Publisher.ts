import { IEvent } from '@nestjs/cqrs';
import { DefaultPubSub } from '@nestjs/cqrs/dist/helpers/default-pubsub';
import { Subject } from 'rxjs';
import { toEventName } from '../utils';
import { PubsubEvent } from '../interface';
import { Producer } from './Producer';

export class Publisher<EventBase extends IEvent> extends DefaultPubSub<EventBase> {
    constructor(subject$: Subject<EventBase>, readonly producer: Producer) {
        super(subject$);
    }

    async publish<T extends EventBase>(event: T): Promise<void> {
        super.publish(event);

        if (event instanceof PubsubEvent) {
            await this.producer.produce(toEventName(event.constructor.name), event.payload(), event.exchange(), event.getOptions());
        }
    }
}

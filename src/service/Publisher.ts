import { Injectable } from '@nestjs/common';
import type { IEvent } from '@nestjs/cqrs';
import { DefaultPubSub } from '@nestjs/cqrs/dist/helpers/default-pubsub';
import { Subject } from 'rxjs';
import { AbstractPubsubEvent } from '../interface';
import { Producer } from './Producer';

@Injectable()
export class Publisher<EventBase extends IEvent> extends DefaultPubSub<EventBase> {
    constructor(subject$: Subject<EventBase>, private readonly producer: Producer) {
        super(subject$);
    }

    async publish<T extends EventBase>(event: T): Promise<void> {
        if (event instanceof AbstractPubsubEvent) {
            event.localEventEnabled() && super.publish(event);
            return this.producer.produce(event);
        }

        return super.publish(event);
    }
}

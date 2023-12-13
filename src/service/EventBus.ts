import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { IEvent } from '@nestjs/cqrs';
import { EventBus as NestEventBus, UnhandledExceptionBus } from '@nestjs/cqrs';
import { CommandBus } from './CommandBus';
import { Producer } from './Producer';
import { Publisher } from './Publisher';

@Injectable()
export class EventBus extends NestEventBus<IEvent> {
    private _pubSubPublisher: Publisher;

    get publisher(): Publisher {
        return this._pubSubPublisher;
    }

    set publisher(pubSubPublisher: Publisher) {
        super.publisher = pubSubPublisher;
        this._pubSubPublisher = pubSubPublisher;
    }

    constructor(commandBus: CommandBus, moduleRefs: ModuleRef, unhandledExceptionBus: UnhandledExceptionBus, private readonly producer: Producer) {
        super(commandBus, moduleRefs, unhandledExceptionBus);
        this.usePubSubPublisher();
    }

    async publish<T extends IEvent>(event: T): Promise<void> {
        return super.publish(event);
    }

    async publishAll<T extends IEvent>(events: T[]): Promise<void> {
        return super.publishAll(events);
    }

    private usePubSubPublisher(): void {
        const pubSubPublisher = new Publisher(this.subject$, this.producer);

        super.publisher = pubSubPublisher;
        this._pubSubPublisher = pubSubPublisher;
    }
}

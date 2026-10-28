import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { IEvent } from '@nestjs/cqrs';
import { EventBus as NestEventBus } from '@nestjs/cqrs';
import { CQRS_UNHANDLED_EXCEPTION_BUS } from '../provider';
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

    /**
     * @param unhandledExceptionBus UnhandledExceptionBus of @nestjs/cqrs 10, which earlier versions don't have
     */
    constructor(
        commandBus: CommandBus,
        moduleRefs: ModuleRef,
        @Optional() @Inject(CQRS_UNHANDLED_EXCEPTION_BUS) unhandledExceptionBus: unknown,
        private readonly producer: Producer,
    ) {
        // The base constructor takes the UnhandledExceptionBus only since @nestjs/cqrs 10, earlier versions ignore it
        super(...([commandBus, moduleRefs, unhandledExceptionBus] as unknown[] as ConstructorParameters<typeof NestEventBus>));
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

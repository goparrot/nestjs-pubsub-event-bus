import type { Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EventHandlerType } from '@nestjs/cqrs';
import type { IPubsubEventOptions } from '../decorator';
import { PUBSUB_EVENT_HANDLER_METADATA, PUBSUB_EVENT_METADATA } from '../decorator';
import type { AbstractSubscriptionEvent, IPubsubEventHandlerMetadata } from '../interface';

@Injectable()
export class PubSubReflector extends Reflector {
    reflectHandlerMetadata<T extends AbstractSubscriptionEvent<any>>(handler: EventHandlerType<T>): IPubsubEventHandlerMetadata<T> | undefined {
        return this.get(PUBSUB_EVENT_HANDLER_METADATA, handler);
    }

    reflectEventMetadata<T extends AbstractSubscriptionEvent<any>>(event: Type<T>): IPubsubEventOptions | undefined {
        return this.get(PUBSUB_EVENT_METADATA, event);
    }

    extractEventMetadata<T extends AbstractSubscriptionEvent<any>>(event: T): IPubsubEventOptions | undefined {
        return this.reflectEventMetadata(event.constructor as Type<T>);
    }
}

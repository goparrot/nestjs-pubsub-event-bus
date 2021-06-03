import type { Type } from '@nestjs/common';
import 'reflect-metadata';
import type { AutoAckEnum, PubsubEventListener } from '../interface';
import { PUBSUB_EVENT_HANDLER_METADATA } from './constant';

export interface IPubsubEventHandlerOptions {
    /**
     * Defines automatic message acknowledgement mode
     * @default ALWAYS_ACK
     */
    autoAck?: AutoAckEnum;
}

export type EventsWithOptions = [...Type<PubsubEventListener<any>>[], IPubsubEventHandlerOptions];

export function PubsubEventHandler(...params: EventsWithOptions);
export function PubsubEventHandler(...events: Type<PubsubEventListener<any>>[]);

export function PubsubEventHandler(...params: Type<PubsubEventListener<any>>[] | EventsWithOptions): ClassDecorator {
    if (!params.length) {
        return Reflect.metadata(PUBSUB_EVENT_HANDLER_METADATA, { events: [] });
    }
    const optionsOrEvent: IPubsubEventHandlerOptions | Type<PubsubEventListener<any>> = params[params.length - 1];

    if (typeof optionsOrEvent === 'object') {
        return Reflect.metadata(PUBSUB_EVENT_HANDLER_METADATA, {
            ...optionsOrEvent,
            events: params.slice(0, -1),
        });
    }

    return Reflect.metadata(PUBSUB_EVENT_HANDLER_METADATA, { events: params });
}

import type { Type } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import type { AbstractSubscriptionEvent, AutoAckEnum, BindingQueueOptions, IRetryOptions } from '../interface';
import { PUBSUB_EVENT_HANDLER_METADATA } from './constant';

export interface IPubsubEventHandlerOptions {
    /**
     * Defines automatic message acknowledgement mode
     * @default ALWAYS_ACK
     */
    autoAck?: AutoAckEnum;

    /**
     * Custom queue name
     */
    queue?: string;

    /**
     * Queue binding options
     */
    bindingQueueOptions?: BindingQueueOptions;

    /**
     * Options for the retry mechanism. Only applicable when `autoAck` is `AUTO_RETRY`
     */
    retryOptions?: IRetryOptions;
}

export type EventsWithOptions = [...Type<AbstractSubscriptionEvent<any>>[], IPubsubEventHandlerOptions];

export function PubsubEventHandler(...params: EventsWithOptions);
export function PubsubEventHandler(...events: Type<AbstractSubscriptionEvent<any>>[]);

export function PubsubEventHandler(...params: Type<AbstractSubscriptionEvent<any>>[] | EventsWithOptions): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return <TFunction extends Function>(target: TFunction): TFunction => {
        if (!params.length) {
            return Reflect.decorate([Reflect.metadata(PUBSUB_EVENT_HANDLER_METADATA, { events: [] }), EventsHandler()], target) as TFunction;
        }

        let options: IPubsubEventHandlerOptions = {};
        let events: Type<AbstractSubscriptionEvent<any>>[];

        const optionsOrEvent: IPubsubEventHandlerOptions | Type<AbstractSubscriptionEvent<any>> = params[params.length - 1];

        if (typeof optionsOrEvent === 'object') {
            options = optionsOrEvent;
            events = params.slice(0, -1) as Type<AbstractSubscriptionEvent<any>>[];
        } else {
            events = params as Type<AbstractSubscriptionEvent<any>>[];
        }

        return Reflect.decorate([Reflect.metadata(PUBSUB_EVENT_HANDLER_METADATA, { ...options, events }), EventsHandler(...events)], target) as TFunction;
    };
}

import { PUBSUB_EVENT_METADATA } from './constant';

export interface IPubsubEventOptions {
    /**
     * The exchange where the event is both published to and listened from
     */
    exchange: string;
    /**
     * Custom routing key where the event is published to and listened from
     */
    customRoutingKey?: string;
    /**
     * Custom routing key where the event is listened from, overrides `customRoutingKey`
     */
    customBindingPattern?: string;
}

export function PubsubEvent(options: IPubsubEventOptions): ClassDecorator {
    return Reflect.metadata(PUBSUB_EVENT_METADATA, options);
}

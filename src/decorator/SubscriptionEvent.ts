import type { IPubsubEventOptions } from './PubsubEvent';
import { PubsubEvent } from './PubsubEvent';

export type ISubscriptionEventOptions = Omit<IPubsubEventOptions, 'customRoutingKey'>;

export function SubscriptionEvent(options: ISubscriptionEventOptions): ClassDecorator {
    return PubsubEvent({ ...options });
}

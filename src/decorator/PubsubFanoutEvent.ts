import type { IPubsubEventOptions } from './PubsubEvent';
import { PubsubEvent } from './PubsubEvent';

export type IPubsubFanoutEventOptions = Omit<IPubsubEventOptions, 'customRoutingKey'>;

export function PubsubFanoutEvent(options: IPubsubFanoutEventOptions): ClassDecorator {
    return PubsubEvent({ ...options, customRoutingKey: '#' });
}

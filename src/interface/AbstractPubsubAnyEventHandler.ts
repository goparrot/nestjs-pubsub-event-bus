import type { AbstractPubsubHandler } from './AbstractPubsubHandler';
import type { AbstractSubscriptionEvent } from './AbstractSubscriptionEvent';

export type AbstractPubsubAnyEventHandler = AbstractPubsubHandler<AbstractSubscriptionEvent<Record<string, any> | Buffer>>;

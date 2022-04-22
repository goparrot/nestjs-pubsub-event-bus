import type { Type } from '@nestjs/common';
import type { IPubsubEventHandlerOptions } from '../decorator';
import type { AbstractPubsubHandler } from './AbstractPubsubHandler';
import type { AbstractSubscriptionEvent } from './AbstractSubscriptionEvent';
import type { IEventWrapper } from './IEventWrapper';

export interface IHandlerWrapper<T extends AbstractSubscriptionEvent<any> = AbstractSubscriptionEvent<any>> {
    handler: Type<AbstractPubsubHandler<T>>;
    eventWrappers: IEventWrapper<T>[];
    options: Omit<IPubsubEventHandlerOptions, 'queue'>;
    queue: string;
}

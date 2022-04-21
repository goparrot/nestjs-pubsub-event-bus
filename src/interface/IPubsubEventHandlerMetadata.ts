import type { Type } from '@nestjs/common';
import type { IPubsubEventHandlerOptions } from '../decorator';
import type { AbstractSubscriptionEvent } from './AbstractSubscriptionEvent';

export interface IPubsubEventHandlerMetadata<T extends AbstractSubscriptionEvent<any> = AbstractSubscriptionEvent<any>> extends IPubsubEventHandlerOptions {
    events: Type<T>[];
}

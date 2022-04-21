import type { Type } from '@nestjs/common';
import type { IPubsubEventOptions } from '../decorator';
import type { AbstractSubscriptionEvent } from './AbstractSubscriptionEvent';

export interface IEventWrapper<T extends AbstractSubscriptionEvent<any> = AbstractSubscriptionEvent<any>> {
    event: Type<T>;
    options: IPubsubEventOptions;
}

import type { Type } from '@nestjs/common';
import type { IPubsubEventOptions } from '../decorator';
import type { AbstractPubsubEvent } from './AbstractPubsubEvent';

export interface IEventWrapper<T extends AbstractPubsubEvent<any> = AbstractPubsubEvent<any>> extends IPubsubEventOptions {
    event: Type<T>;
}

import type { Type } from '@nestjs/common';
import type { IPubsubEventHandlerOptions } from '../decorator';
import type { AbstractPubsubEvent } from './AbstractPubsubEvent';
import type { AbstractPubsubHandler } from './AbstractPubsubHandler';
import type { IEventWrapper } from './IEventWrapper';

export interface IHandlerWrapper<T extends AbstractPubsubEvent<any> = AbstractPubsubEvent<any>> {
    handler: Type<AbstractPubsubHandler<T>>;
    eventWrappers: IEventWrapper<T>[];
    options: IPubsubEventHandlerOptions;
}

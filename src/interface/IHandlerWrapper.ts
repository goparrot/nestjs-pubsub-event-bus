import type { Type } from '@nestjs/common';
import type { AbstractPubsubEvent } from './AbstractPubsubEvent';
import type { AbstractPubsubHandler } from './AbstractPubsubHandler';
import type { IEventWrapper } from './IEventWrapper';
import type { IPubsubEventHandlerMetadata } from './IPubsubEventHandlerMetadata';

export interface IHandlerWrapper<T extends AbstractPubsubEvent<any> = AbstractPubsubEvent<any>> extends Omit<IPubsubEventHandlerMetadata, 'events'> {
    handler: Type<AbstractPubsubHandler<T>>;
    eventWrappers: IEventWrapper<T>[];
}

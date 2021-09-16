import type { Type } from '@nestjs/common';
import type { IPubsubEventHandlerOptions } from '../decorator';
import type { AbstractPubsubEvent } from './AbstractPubsubEvent';

export interface IPubsubEventHandlerMetadata<T extends AbstractPubsubEvent<any> = AbstractPubsubEvent<any>> extends IPubsubEventHandlerOptions {
    events: Type<T>[];
}

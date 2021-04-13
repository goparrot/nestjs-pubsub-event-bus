import type { Type } from '@nestjs/common';
import type { IPubsubEventHandlerOptions } from '../decorator';
import type { PubsubEvent } from './index';

export interface IPubsubEventHandlerMetadata extends IPubsubEventHandlerOptions {
    events: Type<PubsubEvent<any>>[];
}

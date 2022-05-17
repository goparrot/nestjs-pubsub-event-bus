import type { Type } from '@nestjs/common';
import type { IEvent } from '@nestjs/cqrs';
import { first, firstValueFrom } from 'rxjs';
import type { AbstractPubsubAnyEventHandler, EventBus } from '../../src';
import { HandlerBound } from '../../src/lifecycle-event';

export async function waitHandlerBound(eventBus: EventBus, handler: Type<AbstractPubsubAnyEventHandler>): Promise<void> {
    await firstValueFrom(eventBus.subject$.pipe(first((event: IEvent) => event instanceof HandlerBound && event.handlerName === handler.name)));
}

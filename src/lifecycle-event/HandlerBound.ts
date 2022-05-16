import { Injectable } from '@nestjs/common';
import type { IEvent } from '@nestjs/cqrs';

@Injectable()
export class HandlerBound implements IEvent {
    constructor(readonly handlerName: string) {}
}

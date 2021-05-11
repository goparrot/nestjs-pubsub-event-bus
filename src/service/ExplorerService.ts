import { Injectable } from '@nestjs/common';
import { ExplorerService as NestExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';
import { ModulesContainer } from '@nestjs/core';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../decorator';
import type { IEvent, IEventHandler } from '@nestjs/cqrs';
import type { Type } from '@nestjs/common';

@Injectable()
export class ExplorerService extends NestExplorerService {
    constructor(private readonly modules: ModulesContainer) {
        super(modules);
    }

    pubsubEvents(): Type<IEventHandler<IEvent>>[] {
        return this.flatMap<IEventHandler<IEvent>>([...this.modules.values()], (instance) => this.filterProvider(instance, PUBSUB_EVENT_HANDLER_METADATA));
    }
}

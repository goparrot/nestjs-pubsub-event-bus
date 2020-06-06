import { Injectable, Type } from '@nestjs/common';
import { ExplorerService as NestExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';
import { ModulesContainer } from '@nestjs/core';
import { IEvent, IEventHandler } from '@nestjs/cqrs';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../decorator';

@Injectable()
export class ExplorerService extends NestExplorerService {
    constructor(private readonly modules: ModulesContainer) {
        super(modules);
    }

    pubsubEvents(): Type<IEventHandler<IEvent>>[] {
        return this.flatMap<IEventHandler<IEvent>>([...this.modules.values()], (instance) => this.filterProvider(instance, PUBSUB_EVENT_HANDLER_METADATA));
    }
}

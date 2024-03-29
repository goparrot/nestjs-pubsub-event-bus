import type { Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ExplorerService as NestExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../decorator';
import type { AbstractPubsubAnyEventHandler } from '../interface';

@Injectable()
export class ExplorerService extends NestExplorerService {
    constructor(private readonly modules: ModulesContainer) {
        super(modules);
    }

    pubsubEvents(): Type<AbstractPubsubAnyEventHandler>[] {
        return this.flatMap<AbstractPubsubAnyEventHandler>([...this.modules.values()], (instance: InstanceWrapper) => {
            return this.filterProvider(instance, PUBSUB_EVENT_HANDLER_METADATA);
        });
    }
}

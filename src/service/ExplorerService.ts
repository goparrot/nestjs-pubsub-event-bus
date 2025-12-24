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
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const baseService: any = this;
        const modules = [...this.modules.values()];

        if ('filterByMetadataKey' in this) {
            // NestJS 11: flatMap returns InstanceWrapper[], extract metatype
            const wrappers = baseService.flatMap(modules, (instance: InstanceWrapper) => {
                return baseService.filterByMetadataKey(instance, PUBSUB_EVENT_HANDLER_METADATA);
            });
            return wrappers.map((wrapper: any) => wrapper.metatype).filter((metatype: any): metatype is Type<AbstractPubsubAnyEventHandler> => !!metatype);
        }

        return baseService.flatMap(modules, (instance: InstanceWrapper) => {
            return baseService.filterProvider(instance, PUBSUB_EVENT_HANDLER_METADATA);
        });
    }
}

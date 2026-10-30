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
        return [...this.modules.values()].flatMap((module) =>
            [...module.providers.values()].flatMap((wrapper: InstanceWrapper) => this.pubsubHandlerOf(wrapper)),
        );
    }

    /**
     * The same lookup as the provider filter of @nestjs/cqrs, whose helpers return instance wrappers instead of classes since 11
     */
    private pubsubHandlerOf({ instance }: InstanceWrapper): Type<AbstractPubsubAnyEventHandler>[] {
        const handler: unknown = (instance as object | undefined)?.constructor;

        return typeof handler === 'function' && Reflect.getMetadata(PUBSUB_EVENT_HANDLER_METADATA, handler)
            ? [handler as Type<AbstractPubsubAnyEventHandler>]
            : [];
    }
}

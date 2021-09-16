import type { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CqrsModule as NestCqrsModule } from '@nestjs/cqrs';
import type { ICqrsModuleAsyncOptions, ICqrsModuleOptions } from './interface';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from './provider';
import { CommandBus, Consumer, EventBus, ExplorerService, Producer, Publisher, PubSubReflector, QueryBus } from './service';
import { CQRS_MODULE_CONSUMER_OPTIONS, CQRS_MODULE_OPTIONS, DEFAULT_CONSUMER_OPTIONS } from './utils/configuration';

@Module({
    imports: [NestCqrsModule],
    providers: [
        QueryBus,
        EventBus,
        Producer,
        Consumer,
        CommandBus,
        ExplorerService,
        PubSubReflector,
        {
            provide: ConnectionProvider,
            useFactory: (options: ICqrsModuleOptions): ConnectionProvider => ConnectionProvider.forHosts(options.connections),
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: LoggerProvider,
            useFactory: (options: ICqrsModuleOptions): LoggerProvider => LoggerProvider.forLogger(options.logger || new Logger()),
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: ConfigProvider,
            useFactory: (options: ICqrsModuleOptions): ConfigProvider => ConfigProvider.fromOptions(options),
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_MODULE_CONSUMER_OPTIONS,
            useFactory: (options: ICqrsModuleOptions): unknown => ({ ...DEFAULT_CONSUMER_OPTIONS, ...options.config?.consumer }),
            inject: [CQRS_MODULE_OPTIONS],
        },
    ],
    exports: [EventBus, CommandBus, QueryBus, Producer, Consumer],
})
export class CqrsModule implements OnApplicationBootstrap {
    constructor(
        private readonly explorerService: ExplorerService,
        private readonly eventsBus: EventBus,
        private readonly commandsBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly moduleRef: ModuleRef,
    ) {}

    static forRoot(options: ICqrsModuleOptions): DynamicModule {
        return {
            module: CqrsModule,
            global: options.isGlobal,
            providers: [
                {
                    provide: CQRS_MODULE_OPTIONS,
                    useValue: options,
                },
            ],
        };
    }

    static forRootAsync(options: ICqrsModuleAsyncOptions): DynamicModule {
        return {
            module: CqrsModule,
            imports: options.imports,
            providers: [
                {
                    provide: CQRS_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ],
        };
    }

    async onApplicationBootstrap(): Promise<void> {
        const { events, queries, sagas, commands } = this.explorerService.explore();

        this.commandsBus.register(commands);
        this.queryBus.register(queries);
        this.eventsBus.registerSagas(sagas);
        this.eventsBus.register(events);

        this.eventsBus.publisher = new Publisher(this.eventsBus.subject$, this.moduleRef.get(Producer));
        await this.eventsBus.registerPubsubEvents(this.explorerService.pubsubEvents());
    }
}

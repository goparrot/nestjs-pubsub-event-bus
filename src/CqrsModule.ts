import type { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
import { CqrsModule as NestCqrsModule } from '@nestjs/cqrs';
import type { ConnectionUrl } from 'amqp-connection-manager';
import type { ExchangeOptions, IConsumerOptions, ICqrsModuleAsyncOptions, ICqrsModuleOptions, PublishOptions } from './interface';
import { ConfigProvider, LoggerProvider } from './provider';
import { CommandBus, Consumer, EventBus, ExplorerService, Producer, PubSubReflector, QueryBus } from './service';
import {
    CQRS_CONNECTION_NAME,
    CQRS_CONNECTION_URLS,
    CQRS_EXCHANGE_CONFIG,
    CQRS_MODULE_CONSUMER_OPTIONS,
    CQRS_MODULE_OPTIONS,
    CQRS_PRODUCER_CONFIG,
    DEFAULT_CONSUMER_OPTIONS,
    DEFAULT_EXCHANGE_CONFIGURATION,
    DEFAULT_PRODUCER_CONFIGURATION,
} from './utils/configuration';

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
            provide: CQRS_CONNECTION_URLS,
            useFactory(options: ICqrsModuleOptions): ConnectionUrl | ConnectionUrl[] {
                return options.connections;
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: LoggerProvider,
            useFactory(options: ICqrsModuleOptions): LoggerProvider {
                return LoggerProvider.forLogger(options.logger || new Logger());
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: ConfigProvider,
            useFactory(options: ICqrsModuleOptions): ConfigProvider {
                return ConfigProvider.fromOptions(options);
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_MODULE_CONSUMER_OPTIONS,
            useFactory(options: ICqrsModuleOptions): IConsumerOptions {
                return { ...DEFAULT_CONSUMER_OPTIONS, ...options.config?.consumer };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_CONNECTION_NAME,
            useFactory(options: ICqrsModuleOptions): string | undefined {
                return options.connectionName;
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_EXCHANGE_CONFIG,
            useFactory(options: ICqrsModuleOptions): ExchangeOptions {
                return options.config?.exchange || DEFAULT_EXCHANGE_CONFIGURATION;
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_PRODUCER_CONFIG,
            useFactory(options: ICqrsModuleOptions): PublishOptions {
                return options.config?.producer || DEFAULT_PRODUCER_CONFIGURATION;
            },
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
                    inject: options.inject,
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

        await this.eventsBus.registerPubsubEvents(this.explorerService.pubsubEvents());
    }
}

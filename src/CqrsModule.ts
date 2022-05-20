import type { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
import { CqrsModule as NestCqrsModule } from '@nestjs/cqrs';
import type { AmqpConnectionManagerOptions, ConnectionUrl } from 'amqp-connection-manager';
import type {
    BindingQueueOptions,
    ExchangeOptions,
    IConsumerOptions,
    ICqrsModuleAsyncOptions,
    ICqrsModuleOptions,
    IRetryOptions,
    PublishOptions,
} from './interface';
import { createPrepareHandlerStrategiesProviders, LoggerProvider } from './provider';
import { CommandBus, Consumer, EventBus, ExplorerService, Producer, PubSubEventBinder, PubSubReflector, QueryBus } from './service';
import {
    CQRS_BINDING_QUEUE_CONFIG,
    CQRS_CONNECTION_MANAGER_OPTIONS,
    CQRS_CONNECTION_NAME,
    CQRS_CONNECTION_URLS,
    CQRS_EXCHANGE_CONFIG,
    CQRS_MODULE_CONSUMER_OPTIONS,
    CQRS_MODULE_OPTIONS,
    CQRS_PRODUCER_CONFIG,
    CQRS_RETRY_OPTIONS,
    DEFAULT_CONNECTION_MANAGER_OPTIONS,
    DEFAULT_CONSUMER_OPTIONS,
    DEFAULT_EXCHANGE_CONFIGURATION,
    DEFAULT_PRODUCER_CONFIGURATION,
    DEFAULT_QUEUE_BINDING_CONFIGURATION,
    DEFAULT_RETRY_OPTIONS,
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
        PubSubEventBinder,
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
                return { ...DEFAULT_EXCHANGE_CONFIGURATION, ...options.config?.exchange };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_PRODUCER_CONFIG,
            useFactory(options: ICqrsModuleOptions): PublishOptions {
                return { ...DEFAULT_PRODUCER_CONFIGURATION, ...options.config?.producer };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_BINDING_QUEUE_CONFIG,
            useFactory(options: ICqrsModuleOptions): BindingQueueOptions {
                return { ...DEFAULT_QUEUE_BINDING_CONFIGURATION, ...options.config?.bindings };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_CONNECTION_MANAGER_OPTIONS,
            useFactory(options: ICqrsModuleOptions): AmqpConnectionManagerOptions {
                return { ...DEFAULT_CONNECTION_MANAGER_OPTIONS, ...options.config?.connectionManagerOptions };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        {
            provide: CQRS_RETRY_OPTIONS,
            useFactory(options: ICqrsModuleOptions): IRetryOptions {
                return { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
            },
            inject: [CQRS_MODULE_OPTIONS],
        },
        ...createPrepareHandlerStrategiesProviders(),
    ],
    exports: [EventBus, CommandBus, QueryBus, Producer, Consumer],
})
export class CqrsModule implements OnApplicationBootstrap {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly eventsBus: EventBus,
        private readonly commandsBus: CommandBus,
        private readonly explorerService: ExplorerService,
        private readonly pubSubEventBinder: PubSubEventBinder,
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

        await this.pubSubEventBinder.registerPubSubEvents(this.explorerService.pubsubEvents());
    }
}

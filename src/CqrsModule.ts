import type { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { Logger, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CqrsModule as NestCqrsModule } from '@nestjs/cqrs';
import type { ICqrsModuleOptions } from './interface';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from './provider';
import { CommandBus, Consumer, EventBus, ExplorerService, Producer, Publisher, QueryBus } from './service';
import { CONSUMER_OPTIONS, DEFAULT_CONSUMER_OPTIONS } from './utils/configuration';

@Module({
    imports: [NestCqrsModule],
    providers: [ExplorerService, Publisher, CommandBus, QueryBus, EventBus, Producer, Consumer],
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
                    provide: ConnectionProvider,
                    useValue: ConnectionProvider.forHosts(options.connections),
                },
                {
                    provide: LoggerProvider,
                    useValue: LoggerProvider.forLogger(options.logger || new Logger()),
                },
                {
                    provide: ConfigProvider,
                    useValue: ConfigProvider.fromOptions(options),
                },
                {
                    provide: CONSUMER_OPTIONS,
                    useValue: { ...DEFAULT_CONSUMER_OPTIONS, ...options?.config?.consumer },
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

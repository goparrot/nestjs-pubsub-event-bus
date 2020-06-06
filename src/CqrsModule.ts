import { CqrsModule as NestCqrsModule } from '@nestjs/cqrs';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandBus, Consumer, EventBus, ExplorerService, Producer, Publisher, QueryBus } from './service';
import { ICqrsModuleOptions } from './interface';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from './provider';

@Module({
    imports: [NestCqrsModule],
    providers: [ExplorerService, Publisher, CommandBus, QueryBus, EventBus],
    exports: [EventBus, CommandBus, QueryBus],
})
export class CqrsModule {
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
                Producer,
                Consumer,
            ],
            exports: [Producer, Consumer],
        };
    }

    onApplicationBootstrap(): void {
        const { events, queries, sagas, commands } = this.explorerService.explore();
        this.commandsBus.register(commands);
        this.queryBus.register(queries);
        this.eventsBus.registerSagas(sagas);
        this.eventsBus.register(events);

        this.eventsBus.publisher = new Publisher(this.eventsBus.subject$, this.moduleRef.get(Producer));
        this.eventsBus.registerPubsubEvents(this.explorerService.pubsubEvents());
    }
}

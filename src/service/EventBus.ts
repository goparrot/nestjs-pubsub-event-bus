import { Injectable, LoggerService } from '@nestjs/common';
import { EventBus as NestEventBus, EventHandlerType, IEvent, IEventHandler } from '@nestjs/cqrs';
import { ModuleRef } from '@nestjs/core';
import { ConsumeMessage } from 'amqplib';
import { toEventClassName, toEventName } from '../utils';
import { PubsubHandler } from '../interface';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../decorator';
import { LoggerProvider } from '../provider';
import { CommandBus } from './CommandBus';
import { Consumer } from './Consumer';

@Injectable()
export class EventBus<EventBase extends IEvent = IEvent> extends NestEventBus {
    constructor(commandBus: CommandBus, private moduleRefs: ModuleRef) {
        super(commandBus, moduleRefs);
    }

    registerPubsubEvents(handlers: EventHandlerType<EventBase>[] = []): void {
        handlers.forEach((handler: EventHandlerType<EventBase>) => {
            this.registerPubsubHandler(handler);

            const events: string[] = this.reflectPubsubEventsNames(handler).map((event: FunctionConstructor) => {
                return toEventName(event.name);
            });

            this.bindPubsubConsumer((handler as unknown) as PubsubHandler, events);
        });
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected registerPubsubHandler(handler: PubsubHandler | EventHandlerType<EventBase>): void {
        const instance: IEventHandler<EventBase> = this.moduleRefs.get(handler as EventHandlerType<EventBase>, { strict: false });
        if (!instance) {
            return;
        }
        const eventsNames = this.reflectPubsubEventsNames(handler as EventHandlerType<EventBase>);
        eventsNames.map((event) => this.bind(instance, event.name));
    }

    protected bindPubsubConsumer(handler: PubsubHandler | EventHandlerType<EventBase>, events: string[]): void {
        const handlerInstance: PubsubHandler = this.moduleRefs.get(handler as EventHandlerType<EventBase>, { strict: false });
        if (!handlerInstance) {
            return;
        }

        const onMessage: (message: ConsumeMessage | null) => Promise<void> = async (message: ConsumeMessage | null): Promise<void> =>
            void (message && (await this.emitPubsubEvent(handler as EventHandlerType<EventBase>, message)));

        const virtualConsumer: Consumer = Object.create(this.moduleRefs.get(Consumer)) as Consumer;
        virtualConsumer
            .setName(handlerInstance.constructor.name)
            .consume(handlerInstance.exchange(), events, onMessage, handlerInstance.withQueueConfig())
            .catch((): void => {});
    }

    protected reflectPubsubEventsNames(handler: EventHandlerType<EventBase>): FunctionConstructor[] {
        return Reflect.getMetadata(PUBSUB_EVENT_HANDLER_METADATA, handler) as FunctionConstructor[];
    }

    protected emitPubsubEvent = async (handler: EventHandlerType<EventBase>, message: ConsumeMessage): Promise<void> => {
        const event: string = toEventClassName(message.properties.type);

        const instance = this.reflectPubsubEventsNames(handler).find((eventClass: FunctionConstructor) => {
            return event === eventClass.name;
        });

        if (!instance) return;

        this.subject$.next(new instance(JSON.parse(message?.content.toString())));
    };
}

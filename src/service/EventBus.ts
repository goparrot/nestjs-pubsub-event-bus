import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventBus as NestEventBus } from '@nestjs/cqrs';
import { PUBSUB_EVENT_HANDLER_METADATA, PUBSUB_EVENT_NAME } from '../decorator';
import { AutoAckEnum } from '../interface';
import { LoggerProvider } from '../provider';
import { toEventClassName, toEventName } from '../utils';
import { CommandBus } from './CommandBus';
import { Consumer } from './Consumer';
import type { IPubsubEventHandlerMetadata, PubsubEvent, PubsubHandler } from '../interface';
import type { ConsumeMessage } from 'amqplib';
import type { EventHandlerType, IEvent, IEventHandler } from '@nestjs/cqrs';
import type { LoggerService, Type } from '@nestjs/common';

@Injectable()
export class EventBus<EventBase extends IEvent = IEvent> extends NestEventBus {
    constructor(commandBus: CommandBus, private readonly moduleRefs: ModuleRef, private readonly consumer: Consumer) {
        super(commandBus, moduleRefs);
    }

    async registerPubsubEvents(handlers: EventHandlerType<EventBase>[] = []): Promise<void> {
        for (const handler of handlers) {
            const { events, autoAck = AutoAckEnum.ALWAYS_ACK }: IPubsubEventHandlerMetadata = this.reflectPubsubMetadata(handler);

            this.consumer.configureAutoAck(handler, autoAck);
            this.registerPubsubHandler(handler, events);

            const eventNames: string[] = events.map((event: Type<PubsubEvent<any>>): string => {
                return Reflect.getMetadata(PUBSUB_EVENT_NAME, event) ?? toEventName(event.name);
            });

            await this.bindPubsubConsumer(handler, eventNames);
        }
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected registerPubsubHandler(handler: PubsubHandler | EventHandlerType<EventBase>, events: Type<PubsubEvent<any>>[]): void {
        const instance: IEventHandler<EventBase> = this.moduleRefs.get(handler as EventHandlerType<EventBase>, { strict: false });
        if (!instance) {
            return;
        }

        events.forEach((event: Type<PubsubEvent<any>>) => this.bind(instance, event.name));
    }

    protected async bindPubsubConsumer(handler: EventHandlerType<EventBase>, events: string[]): Promise<void> {
        const handlerInstance: PubsubHandler = this.moduleRefs.get(handler, { strict: false });
        if (!handlerInstance) {
            return;
        }

        const onMessage = (message: ConsumeMessage | null): void => {
            if (message) {
                this.emitPubsubEvent(handler, message);
            }
        };

        await this.consumer.consume(handlerInstance, events, onMessage);
    }

    protected reflectPubsubMetadata(handler: EventHandlerType<EventBase>): IPubsubEventHandlerMetadata {
        return Reflect.getMetadata(PUBSUB_EVENT_HANDLER_METADATA, handler) as IPubsubEventHandlerMetadata;
    }

    protected emitPubsubEvent = (handler: EventHandlerType<EventBase>, message: ConsumeMessage): void => {
        const eventClassName: string = toEventClassName(message.properties.type);

        const { events }: IPubsubEventHandlerMetadata = this.reflectPubsubMetadata(handler);

        const instance: Type<PubsubEvent<any>> | undefined = events.find((eventClass: Type<PubsubEvent<any>>) => {
            return eventClassName === eventClass.name || Reflect.getMetadata(PUBSUB_EVENT_NAME, eventClass) === message.properties.type;
        });
        if (!instance) {
            return;
        }

        const pubsubEvent: PubsubEvent<any> = new instance(JSON.parse(message?.content.toString())).withMessage(message);

        this.subject$.next(pubsubEvent);
    };
}

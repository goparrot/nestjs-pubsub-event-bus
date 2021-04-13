import type { LoggerService, Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { EventHandlerType, IEvent, IEventHandler } from '@nestjs/cqrs';
import { EventBus as NestEventBus } from '@nestjs/cqrs';
import type { ConsumeMessage } from 'amqplib';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../decorator';
import type { IPubsubEventHandlerMetadata, PubsubEvent, PubsubHandler } from '../interface';
import { AutoAckEnum } from '../interface';
import { LoggerProvider } from '../provider';
import { toEventClassName, toEventName } from '../utils';
import { CommandBus } from './CommandBus';
import { Consumer } from './Consumer';

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

            const eventNames: string[] = events.map((event: Type<PubsubEvent<any>>): string => toEventName(event.name));

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

        const instance: Type<PubsubEvent<any>> | undefined = events.find((eventClass: Type<PubsubEvent<any>>) => eventClassName === eventClass.name);
        if (!instance) {
            return;
        }

        const pubsubEvent: PubsubEvent<any> = new instance(JSON.parse(message?.content.toString())).withMessage(message);

        this.subject$.next(pubsubEvent);
    };
}

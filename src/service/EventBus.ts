import type { LoggerService, Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { EventHandlerType, IEvent, IEventHandler } from '@nestjs/cqrs';
import { EventBus as NestEventBus } from '@nestjs/cqrs';
import type { ConsumeMessage } from 'amqplib';
import { PUBSUB_EVENT_HANDLER_METADATA, PUBSUB_EVENT_NAME } from '../decorator';
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

    async publish<T extends IEvent>(event: T): Promise<void> {
        return super.publish(event);
    }

    async publishAll<T extends IEvent>(events: T[]): Promise<void> {
        return super.publishAll(events);
    }

    async registerPubsubEvents(handlers: EventHandlerType<EventBase>[] = []): Promise<void> {
        for (const handler of handlers) {
            const { events, autoAck = AutoAckEnum.ALWAYS_ACK }: IPubsubEventHandlerMetadata = this.reflectPubsubMetadata(handler);

            this.consumer.configureAutoAck(handler, autoAck);
            this.consumer.addHandleCatch(handler);
            this.registerPubsubHandler(handler, events);

            const eventNames: string[] = events.map((event: Type<PubsubEvent<any>>): string => {
                const routingKey: string = Reflect.getMetadata(PUBSUB_EVENT_NAME, event) ?? toEventName(event.name);
                return routingKey === 'Fanout' ? '#' : routingKey;
            });

            await this.bindPubsubConsumer(handler, eventNames);
        }
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected registerPubsubHandler(handler: EventHandlerType<EventBase>, events: Type<PubsubEvent<any>>[]): void {
        const instance: IEventHandler<EventBase> | undefined = this.moduleRefs.get(handler, { strict: false });
        if (!instance) {
            this.logger().warn('Could not get event handler instance', JSON.stringify({ name: handler.name }));
            return;
        }

        events.forEach((event: Type<PubsubEvent<any>>) => this.bind(instance, event.name));
    }

    protected async bindPubsubConsumer(handler: EventHandlerType<EventBase>, events: string[]): Promise<void> {
        const handlerInstance: PubsubHandler | undefined = this.moduleRefs.get(handler, { strict: false });
        if (!handlerInstance) {
            this.logger().warn('Could not get event handler instance', JSON.stringify({ name: handler.name }));
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
        const { events }: IPubsubEventHandlerMetadata = this.reflectPubsubMetadata(handler);
        const eventClassName: string = toEventClassName(message.properties.type);

        const eventClasses: Type<PubsubEvent<any>>[] = events.filter(
            (eventClass: Type<PubsubEvent<any>>) =>
                eventClassName === eventClass.name ||
                Reflect.getMetadata(PUBSUB_EVENT_NAME, eventClass) === message.properties.type ||
                ['#', 'Fanout'].includes(Reflect.getMetadata(PUBSUB_EVENT_NAME, eventClass)),
        );

        const context: Record<string, unknown> = {
            handler: handler.name,
            type: message.properties.type,
            events: events.map((eventClass: Type<PubsubEvent<any>>) => ({
                name: eventClass.name,
                pubsubEventName: Reflect.getMetadata(PUBSUB_EVENT_NAME, eventClass),
            })),
        };

        if (!eventClasses.length) {
            this.logger().warn(
                'No event class matched. Possible reason: handler no longer listens for this type of message, so queue should be unbound',
                JSON.stringify(context),
            );
            this.consumer.ack(message);
            return;
        }

        const [firstEventClass, ...unused]: Type<PubsubEvent<any>>[] = eventClasses;
        if (unused.length) {
            this.logger().warn("Handler's event intersection detected", JSON.stringify({ ...context, used: firstEventClass, unused }));
        }

        const pubsubEvent: PubsubEvent<any> = new firstEventClass(JSON.parse(message.content.toString())).withMessage(message);

        this.subject$.next(pubsubEvent);
    };
}

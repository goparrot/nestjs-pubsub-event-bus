import type { LoggerService, Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { IEventHandler } from '@nestjs/cqrs';
import { EventBus as NestEventBus } from '@nestjs/cqrs';
import type { ConsumeMessage } from 'amqplib';
import { escapeRegExp, omit } from 'lodash';
import type { IPubsubEventOptions } from '../decorator';
import { PubsubEvent, PubsubEventHandler } from '../decorator';
import type { AbstractPubsubEvent, AbstractPubsubHandler, IEventWrapper, IHandlerWrapper, IPubsubEventHandlerMetadata } from '../interface';
import { AutoAckEnum } from '../interface';
import { LoggerProvider } from '../provider';
import { toEventName } from '../utils';
import { CommandBus } from './CommandBus';
import { Consumer } from './Consumer';
import { PubSubReflector } from './PubSubReflector';

@Injectable()
export class EventBus<EventBase extends AbstractPubsubEvent<any> = AbstractPubsubEvent<any>> extends NestEventBus<EventBase> {
    constructor(
        commandBus: CommandBus,
        private readonly moduleRefs: ModuleRef,
        private readonly consumer: Consumer,
        private readonly reflector: PubSubReflector<EventBase>,
    ) {
        super(commandBus, moduleRefs);
    }

    async publish(event: EventBase): Promise<void> {
        return super.publish(event);
    }

    async publishAll(events: EventBase[]): Promise<void> {
        return super.publishAll(events);
    }

    async registerPubsubEvents(handlers: Type<AbstractPubsubHandler<EventBase>>[]): Promise<void> {
        const handlersWithEvents: IHandlerWrapper<EventBase>[] = this.filterValidHandlersWithEvents(handlers);

        for (const mappedHandler of handlersWithEvents) {
            const { handler, autoAck = AutoAckEnum.ALWAYS_ACK }: IHandlerWrapper<EventBase> = mappedHandler;

            this.consumer.configureAutoAck(handler, autoAck);
            this.consumer.addHandleCatch(handler);
            this.registerPubsubHandler(mappedHandler);

            await this.bindPubsubConsumer(mappedHandler);
        }
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected registerPubsubHandler(handlerWrapper: IHandlerWrapper<EventBase>): void {
        const { handler, eventWrappers }: IHandlerWrapper<EventBase> = handlerWrapper;

        const instance: IEventHandler<EventBase> | undefined = this.moduleRefs.get(handler, { strict: false });
        if (!instance) {
            this.logger().warn(`Could not get event handler "${handler.name}" instance`);
            return;
        }

        eventWrappers.forEach((eventWrapper: IEventWrapper<EventBase>) => this.bind(instance, eventWrapper.event.name));
    }

    protected async bindPubsubConsumer(handlerWrapper: IHandlerWrapper<EventBase>): Promise<void> {
        const { handler, eventWrappers }: IHandlerWrapper<EventBase> = handlerWrapper;

        const handlerInstance: AbstractPubsubHandler<EventBase> | undefined = this.moduleRefs.get(handler, { strict: false });
        if (!handlerInstance) {
            this.logger().warn(`Could not get event handler "${handler.name}" instance`);
            return;
        }

        await this.consumer.consume(handlerInstance, eventWrappers, (message: ConsumeMessage | null): void => {
            if (message) {
                this.emitPubsubEvent(handlerWrapper, message);
            }
        });
    }

    protected emitPubsubEvent(handlerWrapper: IHandlerWrapper<EventBase>, message: ConsumeMessage): void {
        const { handler, eventWrappers }: IHandlerWrapper<EventBase> = handlerWrapper;
        const typeProperty: string | unknown = message.properties.type;

        const baseContext: Record<string, unknown> = { handler: handler.name, type: typeProperty };

        if (typeof typeProperty !== 'string') {
            this.logger().warn(JSON.stringify({ ...baseContext, message: 'Message with invalid property "type" consumed' }));
            this.consumer.ack(message);
            return;
        }

        // try exact match at first
        let matchedEventWrappers: IEventWrapper<EventBase>[] = eventWrappers.filter(
            ({ event, exchange }: IEventWrapper<EventBase>) => exchange === message.fields.exchange && toEventName(event.name) === typeProperty,
        );

        // fallback to binding pattern at second
        if (!matchedEventWrappers.length) {
            matchedEventWrappers = eventWrappers.filter((eventWrapper: IEventWrapper<EventBase>) => {
                const bindingPattern: string = this.consumer.extractBindingPattern(eventWrapper);

                return eventWrapper.exchange === message.fields.exchange && EventBus.checkTypeAgainstBinding(typeProperty, bindingPattern);
            });
        }

        if (!matchedEventWrappers.length) {
            this.logger().warn(
                JSON.stringify({
                    ...baseContext,
                    events: matchedEventWrappers.map((eventWrapper: IEventWrapper<EventBase>) => {
                        return {
                            name: eventWrapper.event.name,
                            bindingPattern: this.consumer.extractBindingPattern(eventWrapper),
                        };
                    }),
                    message: 'No event class matched. Possible reason: handler no longer listens for this type of message, so queue should be unbound',
                }),
            );
            this.consumer.ack(message);
            return;
        }

        const eventClasses = matchedEventWrappers.map((eventWrapper: IEventWrapper<EventBase>) => eventWrapper.event);

        const [firstEventClass, ...unused]: Type<EventBase>[] = eventClasses;
        if (unused.length) {
            this.logger().warn(
                JSON.stringify({
                    ...baseContext,
                    used: firstEventClass.name,
                    unused: unused.map((event: Type<EventBase>) => event.name),
                    message: "Handler's event" + ' intersection' + ' detected',
                }),
            );
        }

        const pubsubEvent: EventBase = new firstEventClass(JSON.parse(message.content.toString())).withMessage(message);

        this.subject$.next(pubsubEvent);
    }

    private filterValidHandlersWithEvents(handlers: Type<AbstractPubsubHandler<EventBase>>[]): IHandlerWrapper<EventBase>[] {
        const validHandlersWithEvents: IHandlerWrapper<EventBase>[] = [];

        handlers.forEach((handler: Type<AbstractPubsubHandler<EventBase>>) => {
            const metadata: IPubsubEventHandlerMetadata<EventBase> | undefined = this.reflector.reflectHandlerMetadata(handler);
            if (!metadata) {
                this.logger().error(`Event handler "${handler.name}" should be decorated with "${PubsubEventHandler.name}"`);
                return;
            }

            const eventWrappers: IEventWrapper<EventBase>[] = [];

            metadata.events.forEach((event: Type<EventBase>) => {
                const metadata: IPubsubEventOptions | undefined = this.reflector.reflectEventMetadata(event);
                if (!metadata) {
                    this.logger().error(`Event "${event.name}" should be decorated with "${PubsubEvent.name}"`);
                    return;
                }

                eventWrappers.push({ ...metadata, event });
            });

            validHandlersWithEvents.push({ ...omit(metadata, 'events'), handler, eventWrappers: eventWrappers });
        });

        return validHandlersWithEvents;
    }

    private static checkTypeAgainstBinding(typeProperty: string, bindingPattern: string): boolean {
        // transform pattern to regexp to support "*" binding
        return new RegExp(`^${escapeRegExp(bindingPattern).replace(/\\\*/g, '\\w*')}$`).test(typeProperty);
    }
}

import type { LoggerService, Type } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { escapeRegExp, omit } from 'lodash';
import type { IPubsubEventOptions } from '../decorator';
import { PubsubEvent, PubsubEventHandler } from '../decorator';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, IEventWrapper, IHandlerWrapper, IPubsubEventHandlerMetadata } from '../interface';
import { IConsumerOptions } from '../interface';
import { LoggerProvider } from '../provider';
import { generateQueuePrefixFromPackageName, getMessageExchange, toEventName, toSnakeCase } from '../utils';
import { CQRS_MODULE_CONSUMER_OPTIONS, FAN_OUT_BINDING } from '../utils/configuration';
import { Consumer } from './Consumer';
import { EventBus } from './EventBus';
import { PubSubReflector } from './PubSubReflector';

@Injectable()
export class PubSubEventBinder {
    constructor(
        private readonly consumer: Consumer,
        private readonly eventBus: EventBus,
        private readonly reflector: PubSubReflector,
        @Inject(CQRS_MODULE_CONSUMER_OPTIONS) private readonly consumerOptions: IConsumerOptions,
    ) {}

    async registerPubSubEvents(handlers: Type<AbstractPubsubAnyEventHandler>[]): Promise<void> {
        if (!handlers.length) {
            this.logger().log('No pub-sub event handlers found');
            return;
        }
        const handlersWithEvents: IHandlerWrapper[] = this.filterValidHandlersWithEvents(handlers);

        for (const mappedHandler of handlersWithEvents) {
            this.consumer.configureAutoAck(mappedHandler);
            this.consumer.addHandleCatch(mappedHandler);

            await this.bindPubSubConsumer(mappedHandler);
        }

        await this.consumer.configureRetryInfrastructure(handlersWithEvents);
    }

    protected async bindPubSubConsumer(handlerWrapper: IHandlerWrapper): Promise<void> {
        await this.consumer.consume(handlerWrapper, (message: ConsumeMessage | null) => {
            if (message) {
                this.emitPubSubEvent(handlerWrapper, message);
            }
        });
    }

    protected emitPubSubEvent(handlerWrapper: IHandlerWrapper, message: ConsumeMessage): void {
        const { handler, eventWrappers }: IHandlerWrapper = handlerWrapper;
        const typeProperty: string | unknown = message.properties.type;

        const baseContext: Record<string, unknown> = { handler: handler.name, type: typeProperty };

        if (typeof typeProperty !== 'string') {
            this.logger().warn(
                JSON.stringify({
                    ...baseContext,
                    message: 'Message with invalid property "type" consumed',
                }),
            );
            this.consumer.ack(message);
            return;
        }
        const messageExchange = getMessageExchange(message);

        // try exact match at first
        let matchedEventWrappers: IEventWrapper[] = eventWrappers.filter(
            ({ event, options }: IEventWrapper) => options.exchange === messageExchange && toEventName(event.name) === typeProperty,
        );

        // fallback to binding pattern at second
        if (!matchedEventWrappers.length) {
            matchedEventWrappers = eventWrappers.filter((eventWrapper: IEventWrapper) => {
                const bindingPattern: string = this.consumer.extractBindingPattern(eventWrapper);

                return (
                    eventWrapper.options.exchange === messageExchange &&
                    (bindingPattern === FAN_OUT_BINDING || PubSubEventBinder.checkTypeAgainstBinding(typeProperty, bindingPattern))
                );
            });
        }

        if (!matchedEventWrappers.length) {
            this.logger().warn(
                JSON.stringify({
                    ...baseContext,
                    events: matchedEventWrappers.map((eventWrapper: IEventWrapper) => {
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

        const eventClasses = matchedEventWrappers.map((eventWrapper: IEventWrapper) => eventWrapper.event);

        const [firstEventClass, ...unused]: Type<AbstractSubscriptionEvent<any>>[] = eventClasses;
        if (unused.length) {
            this.logger().warn(
                JSON.stringify({
                    ...baseContext,
                    used: firstEventClass.name,
                    unused: unused.map((event: Type<AbstractSubscriptionEvent<any>>) => event.name),
                    message: "Handler's event intersection detected",
                }),
            );
        }

        const pubSubEvent: AbstractSubscriptionEvent<any> = new firstEventClass(JSON.parse(message.content.toString())).withMessage(message);

        this.eventBus.publisher.publishLocally(pubSubEvent);
    }

    private filterValidHandlersWithEvents(handlers: Type<AbstractPubsubAnyEventHandler>[]): IHandlerWrapper[] {
        const validHandlersWithEvents: IHandlerWrapper[] = [];

        handlers.forEach((handler: Type<AbstractPubsubAnyEventHandler>) => {
            const metadata: IPubsubEventHandlerMetadata | undefined = this.reflector.reflectHandlerMetadata(handler);
            if (!metadata) {
                this.logger().error(`Event handler "${handler.name}" should be decorated with "${PubsubEventHandler.name}"`);
                return;
            }

            const eventWrappers: IEventWrapper[] = [];

            metadata.events.forEach((event: Type<AbstractSubscriptionEvent<any>>) => {
                const metadata: IPubsubEventOptions | undefined = this.reflector.reflectEventMetadata(event);
                if (!metadata) {
                    this.logger().error(`Event "${event.name}" should be decorated with "${PubsubEvent.name}"`);
                    return;
                }

                eventWrappers.push({ event, options: metadata });
            });

            if (!eventWrappers.length) {
                this.logger().error(`Handler "${handler.name}" has no valid events"`);
                return;
            }

            const prefix = this.consumerOptions.queueNamePrefix ?? generateQueuePrefixFromPackageName();
            if (!prefix) {
                throw new Error(
                    '"config.consumer.queueNamePrefix" CQRS Module options parameter should be set or the application should be started using npm scripts.',
                );
            }

            validHandlersWithEvents.push({
                handler,
                eventWrappers,
                options: omit(metadata, 'events'),
                queue: metadata.queue ?? [prefix, toSnakeCase(handler.name)].join(':'),
            });
        });

        return validHandlersWithEvents;
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    private static checkTypeAgainstBinding(typeProperty: string, bindingPattern: string): boolean {
        // transform pattern to regexp to support "*" binding
        return new RegExp(`^${escapeRegExp(bindingPattern).replace(/\\\*/g, '\\w*')}$`).test(typeProperty);
    }
}

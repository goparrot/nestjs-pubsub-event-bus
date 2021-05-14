import { Inject } from '@nestjs/common';
import { AutoAckEnum, IConsumerOptions, PubsubHandler } from '../interface';
import { ConfigProvider } from '../provider';
import { toEventName, toSnakeCase } from '../utils';
import { CQRS_MODULE_CONSUMER_OPTIONS } from '../utils/configuration';
import { PubsubManager } from './PubsubManager';
import type { BindingQueueOptions, PubsubEvent } from '../interface';
import type { ConfirmChannel, ConsumeMessage, Message } from 'amqplib';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { IEventHandler } from '@nestjs/cqrs';
import type { LoggerService, Type } from '@nestjs/common';

export class Consumer extends PubsubManager {
    protected name: string;

    constructor(@Inject(CQRS_MODULE_CONSUMER_OPTIONS) protected readonly options: IConsumerOptions) {
        super();
    }

    async setupChannel(channel: ConfirmChannel): Promise<void> {
        if (this.options.prefetchPerConsumer) {
            await channel.prefetch(this.options.prefetchPerConsumer, false);
        }

        if (this.options.prefetchPerChannel) {
            await channel.prefetch(this.options.prefetchPerChannel, true);
        }
    }

    /**
     * Listen for an event and consume its message payload
     *
     * @param handler - event handler
     * @param events - list of events to listen for
     * @param onMessage - a callback that receives an event message
     */
    async consume(handler: PubsubHandler, events: string[], onMessage: (message: ConsumeMessage | null) => void): Promise<void> {
        if (this.appInTestingMode()) return;

        const exchange: string = handler.exchange();
        const queueName: string = handler.queue() ?? this.queue(handler);
        const listenFor: string[] = this.listenFor(handler, events);

        await this.channelWrapper$.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                channel.assertExchange(exchange, 'topic', this.exchangeOptions()),
                channel.assertQueue(queueName, this.bindingOptions(handler.withQueueConfig())),
                ...listenFor.map(async (event: string) => channel.bindQueue(queueName, exchange, event)),
                channel.consume(queueName, (msg: ConsumeMessage | null) => {
                    try {
                        onMessage(msg);
                    } catch (e) {
                        this.logger().warn(`Message execution/acknowledge error: [${(e as Error).message}]`);
                    }
                }),
            ]);

            this.logger().log(`Listening for "${listenFor.join(', ')}" events from [${exchange} <- ${queueName}]`);
        });
    }

    configureAutoAck(handler: Type<IEventHandler>, autoAck: AutoAckEnum): void {
        switch (autoAck) {
            case AutoAckEnum.NEVER:
                this.implementAckAndNack(handler);
                break;

            case AutoAckEnum.ALWAYS_ACK:
                this.mockAckAndNack(handler);
                this.addAlwaysPositiveAck(handler);
                break;

            case AutoAckEnum.ACK_AND_NACK:
                this.mockAckAndNack(handler);
                this.addAutoAck(handler);
                break;
        }
    }

    /**
     * Event, that consumer should listen for (Ex.: order.created, user.*, *.created, etc...)
     */
    protected listenFor = (handler: PubsubHandler, events?: string[]): string[] => {
        if (events?.length) {
            return events;
        }

        return [toEventName(handler.constructor.name.replace(/Handler$/i, ''))];
    };

    /**
     * Queue that should be listened for events.
     */
    protected queue(handler: PubsubHandler): string {
        const pckName: string = (process.env.npm_package_name as string).split('/').pop() as string;
        const platform = pckName.replace(/[_-]/gi, '.');

        return [handler.exchange(), platform, this.toConsumerClassName(handler)].join(':');
    }

    protected bindingOptions(extra: BindingQueueOptions = {}): BindingQueueOptions {
        return {
            ...this.consumerConfiguration(),
            ...extra,
        };
    }

    protected consumerConfiguration(): BindingQueueOptions {
        return ConfigProvider.bindings;
    }

    protected toConsumerClassName(handler: PubsubHandler): string {
        return toSnakeCase(handler.constructor.name);
    }

    private implementAckAndNack(handler: Type<IEventHandler>): void {
        const channel: ChannelWrapper = this.channelWrapper$;

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'ack'),
            value(event: PubsubEvent<any>): void {
                const message: Message | undefined = event.message();
                if (message) {
                    channel.ack(message);
                }
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'nack'),
            value(event: PubsubEvent<any>): void {
                const message: Message | undefined = event.message();
                if (message) {
                    channel.nack(message);
                }
            },
        });
    }

    private mockAckAndNack(handler: Type<IEventHandler>): void {
        const logger: LoggerService = this.logger();

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(PubsubHandler.prototype, 'ack'),
            value(_event: PubsubEvent<any>): void {
                logger.warn('"ack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(PubsubHandler.prototype, 'nack'),
            value(_event: PubsubEvent<any>): void {
                logger.warn('"nack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });
    }

    private addAlwaysPositiveAck(handler: Type<IEventHandler>): void {
        const handleDescriptor: PropertyDescriptor | undefined = Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle');
        if (!handleDescriptor) {
            return;
        }
        const originalMethod = handleDescriptor.value as IEventHandler['handle'];

        const channel: ChannelWrapper = this.channelWrapper$;
        Reflect.defineProperty(handler.prototype, 'handle', {
            ...handleDescriptor,
            async value(event: PubsubEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } finally {
                    const message: Message | undefined = event.message();
                    if (message) {
                        channel.ack(message);
                    }
                }
            },
        });
    }

    private addAutoAck(handler: Type<IEventHandler>): void {
        const handleDescriptor: PropertyDescriptor | undefined = Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle');
        if (!handleDescriptor) {
            return;
        }
        const originalMethod = handleDescriptor.value as IEventHandler['handle'];

        const channel: ChannelWrapper = this.channelWrapper$;
        Reflect.defineProperty(handler.prototype, 'handle', {
            ...handleDescriptor,
            async value(event: PubsubEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                    const message: Message | undefined = event.message();
                    if (message) {
                        channel.ack(message);
                    }
                } catch (e) {
                    const message: Message | undefined = event.message();
                    if (message) {
                        channel.nack(message);
                    }
                    throw e;
                }
            },
        });
    }
}

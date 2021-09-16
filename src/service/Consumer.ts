import type { LoggerService, Type } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { ConfirmChannel, ConsumeMessage, Message, Replies } from 'amqplib';
import { chain } from 'lodash';
import type { AbstractSubscriptionEvent, BindingQueueOptions, IEventWrapper } from '../interface';
import { AbstractPubsubHandler, AutoAckEnum, IConsumerOptions } from '../interface';
import { ConfigProvider } from '../provider';
import { toEventName, toSnakeCase } from '../utils';
import { CQRS_MODULE_CONSUMER_OPTIONS } from '../utils/configuration';
import { PubsubManager } from './PubsubManager';

type IPubsubHandler = AbstractPubsubHandler<AbstractSubscriptionEvent<any>>;

@Injectable()
export class Consumer extends PubsubManager {
    /**
     * Set of exchanges that handlers listen to
     */
    private readonly exchanges: Set<string> = new Set<string>();

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
     * @param eventWrappers - list of events with metadata to listen to
     * @param onMessage - a callback that receives an event message
     */
    async consume(handler: IPubsubHandler, eventWrappers: IEventWrapper[], onMessage: (message: ConsumeMessage | null) => void): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }

        const requiredExchanges: string[] = chain(eventWrappers)
            .map((event: IEventWrapper) => event.exchange)
            .uniq()
            .value();

        const notAssertedExchanges: string[] = requiredExchanges.filter((exchange: string) => !this.exchanges.has(exchange));

        notAssertedExchanges.forEach((exchange: string) => this.exchanges.add(exchange));

        const queueName: string = handler.queue() ?? this.queue(handler);
        const bindingPatterns: string[] = eventWrappers.map((event: IEventWrapper) => this.extractBindingPattern(event));

        await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                ...notAssertedExchanges.map((exchange: string) => channel.assertExchange(exchange, 'topic', this.exchangeOptions())),
                channel.assertQueue(queueName, this.bindingOptions(handler.withQueueConfig())),
                ...this.bindEvents(channel, queueName, eventWrappers),
                channel.consume(queueName, (msg: ConsumeMessage | null) => {
                    try {
                        onMessage(msg);
                    } catch (e) {
                        this.logger().warn(`Message execution/acknowledge error: [${(e as Error).message}]`);
                    }
                }),
            ]);

            this.logger().log(`Listening for "${bindingPatterns.join(', ')}" events from [${requiredExchanges.join(', ')} <- ${queueName}]`);
        });
    }

    extractBindingPattern(mappedEvent: IEventWrapper): string {
        const { customBindingPattern, customRoutingKey, event }: IEventWrapper = mappedEvent;

        return customBindingPattern ?? customRoutingKey ?? toEventName(event.name);
    }

    configureAutoAck(handler: Type<IPubsubHandler>, autoAck: AutoAckEnum): void {
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

    addHandleCatch(handler: Type<IPubsubHandler>): void {
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;
        const logger: LoggerService = this.logger();

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } catch (error) {
                    logger.error(JSON.stringify({ error, event }), error instanceof Error ? error.stack : undefined, handler.name);
                }
            },
        });
    }

    ack(message: Message): void {
        if (this.appInTestingMode()) {
            return;
        }
        this.channelWrapper.ack(message);
    }

    nack(message: Message): void {
        if (this.appInTestingMode()) {
            return;
        }
        this.channelWrapper.nack(message);
    }

    /**
     * Queue that should be listened for events.
     */
    protected queue(handler: IPubsubHandler): string {
        const pckName: string = (process.env.npm_package_name as string).split('/').pop() as string;
        const platform = pckName.replace(/[_-]/gi, '.');

        return [platform, toSnakeCase(handler.constructor.name)].join(':');
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

    private bindEvents(channel: ConfirmChannel, queueName: string, eventWrappers: IEventWrapper[]): Promise<Replies.Empty>[] {
        return eventWrappers.map(async (event: IEventWrapper) => {
            const { exchange }: IEventWrapper = event;

            return channel.bindQueue(queueName, exchange, this.extractBindingPattern(event));
        });
    }

    private implementAckAndNack(handler: Type<IPubsubHandler>): void {
        const ack: (message: Message) => void = this.ack.bind(this);
        const nack: (message: Message) => void = this.nack.bind(this);

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'ack'),
            value(event: AbstractSubscriptionEvent<any>): void {
                const message: Message | undefined = event.message();
                if (message) {
                    ack(message);
                }
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'nack'),
            value(event: AbstractSubscriptionEvent<any>): void {
                const message: Message | undefined = event.message();
                if (message) {
                    nack(message);
                }
            },
        });
    }

    private mockAckAndNack(handler: Type<IPubsubHandler>): void {
        const logger: LoggerService = this.logger();

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(AbstractPubsubHandler.prototype, 'ack'),
            value(_event: AbstractSubscriptionEvent<any>): void {
                logger.warn('"ack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(AbstractPubsubHandler.prototype, 'nack'),
            value(_event: AbstractSubscriptionEvent<any>): void {
                logger.warn('"nack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });
    }

    private addAlwaysPositiveAck(handler: Type<IPubsubHandler>): void {
        const ack: (message: Message) => void = this.ack.bind(this);
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } finally {
                    const message: Message | undefined = event.message();
                    if (message) {
                        ack(message);
                    }
                }
            },
        });
    }

    private addAutoAck(handler: Type<IPubsubHandler>): void {
        const ack: (message: Message) => void = this.ack.bind(this);
        const nack: (message: Message) => void = this.nack.bind(this);
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                    const message: Message | undefined = event.message();
                    if (message) {
                        ack(message);
                    }
                } catch (e) {
                    const message: Message | undefined = event.message();
                    if (message) {
                        nack(message);
                    }
                    throw e;
                }
            },
        });
    }
}

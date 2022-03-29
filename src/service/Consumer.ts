import type { LoggerService, Type } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { ConfirmChannel, ConsumeMessage, Message, Replies } from 'amqplib';
import { chain } from 'lodash';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, AutoAckEnum, IChannelWrapper, IEventWrapper } from '../interface';
import { BindingQueueOptions, IConsumerOptions } from '../interface';
import { CQRS_PREPARE_HANDLER_STRATEGIES, PrepareHandlerStrategies } from '../provider';
import { toEventName, toSnakeCase } from '../utils';
import { CQRS_BINDING_QUEUE_CONFIG, CQRS_MODULE_CONSUMER_OPTIONS } from '../utils/configuration';
import { PubsubManager } from './PubsubManager';

@Injectable()
export class Consumer extends PubsubManager implements IChannelWrapper {
    /**
     * Set of exchanges that handlers listen to
     */
    private readonly exchanges: Set<string> = new Set<string>();

    constructor(
        @Inject(CQRS_MODULE_CONSUMER_OPTIONS) protected readonly options: IConsumerOptions,
        @Inject(CQRS_BINDING_QUEUE_CONFIG) private readonly bindingQueueOptions: BindingQueueOptions,
        @Inject(CQRS_PREPARE_HANDLER_STRATEGIES) private readonly prepareHandlerStrategies: PrepareHandlerStrategies,
    ) {
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
    async consume(handler: AbstractPubsubAnyEventHandler, eventWrappers: IEventWrapper[], onMessage: (message: ConsumeMessage | null) => void): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }

        this.initConnectionIfRequired();
        this.initChannelIfRequired();

        const handlerExchanges = eventWrappers.map((event: IEventWrapper) => event.exchange);

        const exchangesToAssert: string[] = chain(handlerExchanges)
            .filter((exchange: string) => !this.exchanges.has(exchange))
            .uniq()
            .value();

        exchangesToAssert.forEach((exchange: string) => this.exchanges.add(exchange));

        const queueName: string = handler.queue() ?? this.queue(handler);
        const bindingPatterns: string[] = eventWrappers.map((event: IEventWrapper) => this.extractBindingPattern(event));

        await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                ...exchangesToAssert.map((exchange: string) => channel.assertExchange(exchange, 'topic', this.exchangeOptions())),
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

            this.logger().log(`Listening for "${bindingPatterns.join(', ')}" events from [${handlerExchanges.join(', ')} <- ${queueName}]`);
        });
    }

    extractBindingPattern(mappedEvent: IEventWrapper): string {
        const { customBindingPattern, customRoutingKey, event }: IEventWrapper = mappedEvent;

        return customBindingPattern ?? customRoutingKey ?? toEventName(event.name);
    }

    configureAutoAck(handler: Type<AbstractPubsubAnyEventHandler>, autoAck: AutoAckEnum): void {
        this.prepareHandlerStrategies[autoAck].process(handler, this);
    }

    addHandleCatch(handler: Type<AbstractPubsubAnyEventHandler>): void {
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
    protected queue(handler: AbstractPubsubAnyEventHandler): string {
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
        return this.bindingQueueOptions;
    }

    private bindEvents(channel: ConfirmChannel, queueName: string, eventWrappers: IEventWrapper[]): Promise<Replies.Empty>[] {
        return eventWrappers.map(async (event: IEventWrapper) => {
            const { exchange }: IEventWrapper = event;

            return channel.bindQueue(queueName, exchange, this.extractBindingPattern(event));
        });
    }
}

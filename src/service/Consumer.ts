import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { ConfirmChannel, ConsumeMessage, Message, Replies } from 'amqplib';
import { chain } from 'lodash';
import type { AbstractSubscriptionEvent, IChannelWrapper, IEventWrapper, IHandlerWrapper, PublishOptions } from '../interface';
import { AutoAckEnum, BindingQueueOptions, DefaultedRetryOptions, IConsumerOptions, RetryStrategyEnum } from '../interface';
import { HandlerBound } from '../lifecycle-event';
import { CQRS_PREPARE_HANDLER_STRATEGIES, CQRS_RETRY_STRATEGIES, PrepareHandlerStrategies, RetryStrategies } from '../provider';
import { toEventName, toSnakeCase } from '../utils';
import { CQRS_BINDING_QUEUE_CONFIG, CQRS_MODULE_CONSUMER_OPTIONS, CQRS_RETRY_OPTIONS } from '../utils/configuration';
import { EventBus } from './EventBus';
import { PubsubManager } from './PubsubManager';

@Injectable()
export class Consumer extends PubsubManager implements IChannelWrapper {
    /**
     * Set of exchanges that handlers listen to
     */
    private readonly exchanges: Set<string> = new Set<string>();

    constructor(
        private readonly eventBus: EventBus,
        @Inject(CQRS_RETRY_STRATEGIES) private readonly retryStrategies: RetryStrategies,
        @Inject(CQRS_MODULE_CONSUMER_OPTIONS) protected readonly options: IConsumerOptions,
        @Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: DefaultedRetryOptions,
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
     * @param handlerWrapper - event handler wrapper
     * @param onMessage - a callback that receives an event message
     */
    async consume(handlerWrapper: IHandlerWrapper, onMessage: (message: ConsumeMessage | null) => void): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }
        const { handler, eventWrappers, options, queue } = handlerWrapper;

        this.initConnectionIfRequired();
        this.initChannelIfRequired();

        const handlerExchanges = eventWrappers.map((event: IEventWrapper) => event.options.exchange);

        const exchangesToAssert: string[] = chain(handlerExchanges)
            .filter((exchange: string) => !this.exchanges.has(exchange))
            .uniq()
            .value();

        exchangesToAssert.forEach((exchange: string) => this.exchanges.add(exchange));

        const bindingPatterns: string[] = eventWrappers.map((event: IEventWrapper) => this.extractBindingPattern(event));

        await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                ...exchangesToAssert.map((exchange: string) => channel.assertExchange(exchange, 'topic', this.assertExchangeOptions)),
                channel.assertQueue(queue, this.bindingOptions(options.bindingQueueOptions)),
                ...this.bindEvents(channel, queue, eventWrappers),
                channel.consume(queue, (msg: ConsumeMessage | null) => {
                    try {
                        onMessage(msg);
                    } catch (e) {
                        this.logger().warn(`Message execution/acknowledge error: [${(e as Error).message}]`);
                    }
                }),
            ]);

            this.logger().log(`Listening for "${bindingPatterns.join(', ')}" events from [${handlerExchanges.join(', ')} <- ${queue}]`);
            await this.eventBus.publish(new HandlerBound(handler.name));
        });
    }

    extractBindingPattern(mappedEvent: IEventWrapper): string {
        const {
            event,
            options: { customBindingPattern, customRoutingKey },
        }: IEventWrapper = mappedEvent;

        return customBindingPattern ?? customRoutingKey ?? toEventName(event.name);
    }

    configureAutoAck(wrapper: IHandlerWrapper): void {
        this.prepareHandlerStrategies[wrapper.options.autoAck ?? AutoAckEnum.ALWAYS_ACK].process(wrapper, this);
    }

    addHandleCatch(handlerWrapper: IHandlerWrapper): void {
        const { handler } = handlerWrapper;
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;
        const logger: LoggerService = this.logger();

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } catch (error) {
                    logger.error(
                        JSON.stringify({
                            error,
                            event,
                        }),
                        error instanceof Error ? error.stack : undefined,
                        handler.name,
                    );
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

    async publish(exchange: string, routingKey: string, content: Buffer | string | unknown, options?: PublishOptions): Promise<void> {
        await this.channelWrapper.publish(exchange, routingKey, content, options);
    }

    async configureRetryInfrastructure(wrappers: IHandlerWrapper[]): Promise<void> {
        const wrappersWithRetryStrategy = wrappers.filter((wrapper: IHandlerWrapper) => wrapper.options.autoAck === AutoAckEnum.AUTO_RETRY);

        const maxRetryAttempts = Math.max(
            this.rootRetryOptions.maxRetryAttempts,
            ...wrappersWithRetryStrategy.map((wrapper: IHandlerWrapper) => wrapper.options.retryOptions?.maxRetryAttempts ?? 0),
        );

        if (!maxRetryAttempts) {
            this.logger().debug?.('Retry infrastructure configuration skipped because no handlers with auto retry enabled found');
            return;
        }

        if (maxRetryAttempts < 0) {
            throw new Error(`Invalid max retry count value (${maxRetryAttempts})`);
        }

        if (maxRetryAttempts > 100) {
            throw new Error(`Too great value for max retry count (${maxRetryAttempts})`);
        }

        await Promise.all(
            chain(wrappersWithRetryStrategy)
                .groupBy((wrapper: IHandlerWrapper) => wrapper.options.retryOptions?.strategy ?? RetryStrategyEnum.DEAD_LETTER_TTL)
                .entries()
                .map(async ([strategy, wrappers]: [RetryStrategyEnum, IHandlerWrapper[]]) =>
                    this.retryStrategies[strategy].setupInfrastructure(this.channelWrapper, wrappers),
                )
                .value(),
        );
    }

    /**
     * Queue that should be listened for events.
     */
    protected queue(handlerWrapper: IHandlerWrapper): string {
        const pckName: string = (process.env.npm_package_name as string).split('/').pop() as string;
        const platform = pckName.replace(/[_-]/gi, '.');

        return [platform, toSnakeCase(handlerWrapper.handler.name)].join(':');
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
            return channel.bindQueue(queueName, event.options.exchange, this.extractBindingPattern(event));
        });
    }
}

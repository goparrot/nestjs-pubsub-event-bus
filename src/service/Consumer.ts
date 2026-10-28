import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { Channel, ConfirmChannel, ConsumeMessage, Message, Replies } from 'amqplib';
import { chain, uniq } from 'lodash';
import type { AbstractSubscriptionEvent, IChannelWrapper, IEventWrapper, IHandlerWrapper, PublishOptions, RetryStrategyEnum } from '../interface';
import { AutoAckEnum, BindingQueueOptions, DefaultedRetryOptions, IConsumerOptions } from '../interface';
import { HandlerBound } from '../lifecycle-event';
import { CQRS_PREPARE_HANDLER_STRATEGIES, CQRS_RETRY_STRATEGIES, PrepareHandlerStrategies, RetryStrategies } from '../provider';
import { appInTestingMode, toEventName, toSnakeCase } from '../utils';
import { CQRS_BINDING_QUEUE_CONFIG, CQRS_MODULE_CONSUMER_OPTIONS, CQRS_RETRY_OPTIONS } from '../utils/configuration';
import { EventBus } from './EventBus';
import { PubsubManager } from './PubsubManager';
import type { IRetryStrategy } from './retry-strategy';

/**
 * Delay before the first retry of a failed set-up, and before subscribing again after the broker cancels a consumer
 */
const SETUP_RETRY_MIN_DELAY_MS = 1000;

/**
 * Longest delay between set-up retries. Each failed retry doubles the delay, up to this value
 */
const SETUP_RETRY_MAX_DELAY_MS = 10_000;

/**
 * How long a set-up can keep failing before its failures are logged as errors instead of warnings
 */
const SETUP_FAILURE_ERROR_AFTER_MS = 60_000;

/**
 * Something the consumer keeps in place on the broker: the topology a handler needs (exchanges, queue and bindings)
 * together with the consumer on its queue, or topology only, like the retry infrastructure.
 *
 * A subscription is activated on every new consumer channel, that is after the first connect and after each reconnect,
 * and again when the broker cancels its consumer. A failed activation is retried with a backoff.
 */
interface ISubscription {
    /**
     * Describes the subscription in logs, e.g. `queue "my.service:order_created"`
     */
    readonly name: string;

    /**
     * Declares the topology. It runs again on every activation, so the declarations must be idempotent
     */
    readonly declare: (channel: Channel) => Promise<void>;

    /**
     * Starts consuming on the consumer channel. Topology-only subscriptions have no consumer
     */
    readonly consume?: (channel: ConfirmChannel) => Promise<void>;

    /**
     * Consumer channel the subscription is active on. Undefined before the first successful activation and after the
     * broker cancels the consumer
     */
    channel?: ConfirmChannel;

    /**
     * Number of failed activations in a row, which sets the retry delay
     */
    attempt: number;

    /**
     * Start of the current run of failed activations, which decides when failures are logged as errors
     */
    failingSince?: number;

    /**
     * Pending retry, if any
     */
    timer?: NodeJS.Timeout;

    /**
     * Last activation. Activations are chained so that they run one at a time: two concurrent activations could both
     * find the subscription inactive and start two consumers on the same queue
     */
    activation: Promise<void>;
}

/**
 * Consumes pub-sub events for the registered handlers.
 *
 * All consumers share one consumer channel, so the prefetch limits apply across them. The broker can cancel a consumer
 * while the connection stays up, for example when its queue is deleted or when the node hosting a classic queue goes
 * down. Each handler is therefore kept as a subscription, which is set up again after a cancellation or a reconnect.
 *
 * Topology is declared on a short-lived channel. A declaration that fails, for example for a queue whose node is down,
 * then closes only that channel, instead of the consumer channel and the connection with every other consumer on them.
 */
@Injectable()
export class Consumer extends PubsubManager implements IChannelWrapper {
    /**
     * Every registered subscription, so that pending retries can be cancelled on shutdown
     */
    private readonly subscriptions: ISubscription[] = [];

    /**
     * Channel each message was delivered on. An entry goes away with its message object
     */
    private readonly deliveryChannels: WeakMap<Message, ConfirmChannel> = new WeakMap<Message, ConfirmChannel>();

    /**
     * Current consumer channel. Undefined while disconnected
     */
    private consumerChannel: ConfirmChannel | undefined;

    /**
     * Set on shutdown, so that no activation or retry starts afterwards
     */
    private destroyed = false;

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

    /**
     * Prepares a new consumer channel. The channel wrapper calls it on the first connect and after every reconnect,
     * before the set-ups that activate the subscriptions
     */
    async setupChannel(channel: ConfirmChannel): Promise<void> {
        // Channel errors stay unhandled so that they close the connection: the channel wrapper only creates a new
        // channel after reconnecting
        this.consumerChannel = channel;
        channel.once('close', () => {
            if (this.consumerChannel === channel) {
                this.consumerChannel = undefined;
            }
        });

        if (this.options.prefetchPerConsumer) {
            await channel.prefetch(this.options.prefetchPerConsumer, false);
        }

        if (this.options.prefetchPerChannel) {
            await channel.prefetch(this.options.prefetchPerChannel, true);
        }
    }

    /**
     * Listen for an event and consume its message payload. The consumer is set up again after the broker cancels it
     * and after a reconnect
     *
     * @param handlerWrapper - event handler wrapper
     * @param onMessage - a callback that receives an event message
     */
    async consume(handlerWrapper: IHandlerWrapper, onMessage: (message: ConsumeMessage | null) => void): Promise<void> {
        if (appInTestingMode()) {
            return;
        }

        await this.subscribe(this.handlerSubscription(handlerWrapper, onMessage));
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

    /**
     * Acknowledges the message on the channel that delivered it
     */
    ack(message: Message): void {
        if (appInTestingMode()) {
            return;
        }
        this.settle(message, (channel: ConfirmChannel) => channel.ack(message));
    }

    /**
     * Rejects the message on the channel that delivered it. The broker requeues it
     */
    nack(message: Message): void {
        if (appInTestingMode()) {
            return;
        }
        this.settle(message, (channel: ConfirmChannel) => channel.nack(message));
    }

    async publish(exchange: string, routingKey: string, content: Buffer | string | unknown, options?: PublishOptions): Promise<void> {
        await this.channelWrapper.publish(exchange, routingKey, content, options);
    }

    /**
     * Declares the retry infrastructure (exchanges and delay queues) of every retry strategy that a handler uses. Each
     * strategy's infrastructure is a topology-only subscription, so it is declared again after a reconnect and its
     * declarations are retried when they fail
     */
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
                .groupBy((wrapper: IHandlerWrapper) => this.retryStrategy(wrapper).strategy)
                .entries()
                .map(async ([strategy, wrappers]: [RetryStrategyEnum, IHandlerWrapper[]]) =>
                    this.subscribe({
                        name: `${strategy} retry infrastructure`,
                        declare: async (channel: Channel) => this.retryStrategies[strategy].setupInfrastructure(channel, wrappers),
                        attempt: 0,
                        activation: Promise.resolve(),
                    }),
                )
                .value(),
        );
    }

    /**
     * Cancels pending retries before the channel and the connection are closed
     */
    async onModuleDestroy(): Promise<void> {
        this.destroyed = true;
        this.subscriptions.forEach((subscription: ISubscription) => clearTimeout(subscription.timer));
        await super.onModuleDestroy();
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

    private bindEvents(channel: Channel, queueName: string, eventWrappers: IEventWrapper[]): Promise<Replies.Empty>[] {
        return eventWrappers.map(async (event: IEventWrapper) => {
            return channel.bindQueue(queueName, event.options.exchange, this.extractBindingPattern(event));
        });
    }

    /**
     * Retry strategy of an auto-retry handler: the one set on the handler, or the module's. It must match the strategy
     * that AutoRetryStrategy requeues messages with
     */
    private retryStrategy(wrapper: IHandlerWrapper): IRetryStrategy {
        return this.retryStrategies[wrapper.options.retryOptions?.strategy ?? this.rootRetryOptions.strategy];
    }

    /**
     * Builds the subscription of a handler: its exchanges, queue, event bindings and retry binding, and the consumer on
     * its queue
     */
    private handlerSubscription(handlerWrapper: IHandlerWrapper, onMessage: (message: ConsumeMessage) => void): ISubscription {
        const { handler, eventWrappers, options, queue } = handlerWrapper;
        const handlerExchanges = eventWrappers.map((event: IEventWrapper) => event.options.exchange);
        const bindingPatterns = eventWrappers.map((event: IEventWrapper) => this.extractBindingPattern(event));

        const subscription: ISubscription = {
            name: `queue "${queue}"`,
            declare: async (channel: Channel): Promise<void> => {
                await Promise.all(
                    uniq(handlerExchanges).map(async (exchange: string) => channel.assertExchange(exchange, 'topic', this.assertExchangeOptions)),
                );
                await channel.assertQueue(queue, this.bindingOptions(options.bindingQueueOptions));
                await Promise.all(this.bindEvents(channel, queue, eventWrappers));

                if (options.autoAck === AutoAckEnum.AUTO_RETRY) {
                    await this.retryStrategy(handlerWrapper).bindQueue(channel, handlerWrapper);
                }
            },
            consume: async (channel: ConfirmChannel): Promise<void> => {
                // amqplib calls the callback with null when the broker cancels the consumer
                await channel.consume(queue, (message: ConsumeMessage | null) => {
                    if (message) {
                        this.deliver(channel, message, onMessage);
                    } else {
                        this.onConsumerCancelled(subscription, channel);
                    }
                });

                // The consumer is live: a failure from here on must not make the subscription consume again
                try {
                    this.logger().log(`Listening for "${bindingPatterns.join(', ')}" events from [${handlerExchanges.join(', ')} <- ${queue}]`);
                    await this.eventBus.publish(new HandlerBound(handler.name));
                } catch (error) {
                    this.logger().warn(`Publishing HandlerBound for ${subscription.name} failed: ${(error as Error).message}`);
                }
            },
            attempt: 0,
            activation: Promise.resolve(),
        };

        return subscription;
    }

    /**
     * Registers the subscription as a set-up of the consumer channel. The channel wrapper runs the set-up right away if
     * the channel is open, and again on every new channel after a reconnect
     */
    private async subscribe(subscription: ISubscription): Promise<void> {
        this.initConnectionIfRequired();
        this.initChannelIfRequired();

        this.subscriptions.push(subscription);
        await this.channelWrapper.addSetup(async () => this.activate(subscription));
    }

    /**
     * Queues an activation after the previous one, and resolves once it has run
     */
    private async activate(subscription: ISubscription): Promise<void> {
        subscription.activation = subscription.activation.then(async () => this.tryActivate(subscription));

        return subscription.activation;
    }

    /**
     * Activates the subscription on the current consumer channel: declares its topology on a short-lived channel, then
     * starts its consumer. If either step fails, a retry is scheduled
     */
    private async tryActivate(subscription: ISubscription): Promise<void> {
        const channel = this.consumerChannel;

        // Nothing to do after shutdown, while disconnected (the set-up of the next channel activates the subscription),
        // or when the subscription is already active on this channel
        if (this.destroyed || !channel || subscription.channel === channel) {
            return;
        }
        clearTimeout(subscription.timer);

        try {
            await this.declare(subscription.declare);

            // The consumer channel closed while the topology was being declared: the set-up of the next channel
            // activates the subscription
            if (channel !== this.consumerChannel) {
                return;
            }

            // Set before consuming: the broker can cancel the consumer in the same read as the consume reply, before
            // the reply resolves
            subscription.channel = channel;
            await subscription.consume?.(channel);
        } catch (error) {
            if (subscription.channel === channel) {
                subscription.channel = undefined;
            }
            this.retryLater(subscription, error as Error);
            return;
        }

        subscription.attempt = 0;
        subscription.failingSince = undefined;
    }

    /**
     * Handles a consumer that the broker cancelled while the connection stays up. The subscription is activated again
     * after a short delay: the declarations re-create a deleted queue, and while the queue stays unavailable, the retry
     * backoff takes over
     */
    private onConsumerCancelled(subscription: ISubscription, channel: ConfirmChannel): void {
        this.logger().warn(`The broker cancelled the consumer of ${subscription.name}, subscribing again`);

        if (subscription.channel === channel) {
            subscription.channel = undefined;
        }
        this.scheduleActivation(subscription, SETUP_RETRY_MIN_DELAY_MS);
    }

    /**
     * Schedules the next activation after a failure. The delay doubles from 1 to 10 seconds. Failures are logged as
     * warnings at first, and as errors once they have lasted a minute, so that a queue left without a consumer gets
     * noticed
     */
    private retryLater(subscription: ISubscription, error: Error): void {
        const delay = Math.min(SETUP_RETRY_MIN_DELAY_MS * 2 ** subscription.attempt, SETUP_RETRY_MAX_DELAY_MS);
        subscription.attempt++;
        subscription.failingSince ??= Date.now();

        const message = `Failed to set up ${subscription.name}, retrying in ${delay} ms: ${error.message}`;
        if (Date.now() - subscription.failingSince < SETUP_FAILURE_ERROR_AFTER_MS) {
            this.logger().warn(message);
        } else {
            this.logger().error(message);
        }

        this.scheduleActivation(subscription, delay);
    }

    /**
     * Schedules an activation, replacing the pending one. The timer does not keep the process alive
     */
    private scheduleActivation(subscription: ISubscription, delay: number): void {
        clearTimeout(subscription.timer);

        if (!this.destroyed) {
            subscription.timer = setTimeout(() => void this.activate(subscription), delay).unref();
        }
    }

    /**
     * Declares topology on a separate channel, so that a failed declaration does not close the consumer channel
     */
    private async declare(declareTopology: (channel: Channel) => Promise<void>): Promise<void> {
        const connection = this.connection.connection;
        if (!connection) {
            throw new Error('Amqp connection has not been established');
        }

        const channel: Channel = await connection.createChannel();
        // Without a listener, amqplib rethrows the channel error, which closes the connection. The error still rejects
        // the failed declaration
        channel.on('error', () => undefined);

        try {
            await declareTopology(channel);
        } finally {
            await channel.close().catch(() => undefined);
        }
    }

    /**
     * Records the channel that delivered the message, so that the message is settled on that channel, and passes the
     * message to the handler
     */
    private deliver(channel: ConfirmChannel, message: ConsumeMessage, onMessage: (message: ConsumeMessage) => void): void {
        this.deliveryChannels.set(message, channel);

        try {
            onMessage(message);
        } catch (e) {
            this.logger().warn(`Message execution/acknowledge error: [${(e as Error).message}]`);
        }
    }

    /**
     * Settles the message on the channel that delivered it. Delivery tags are scoped to a channel, so settling on
     * another channel would fail or settle a different message. A message whose channel has closed is skipped: the
     * broker already requeued it when the channel closed
     */
    private settle(message: Message, operation: (channel: ConfirmChannel) => void): void {
        const channel = this.deliveryChannels.get(message);

        if (!channel || channel !== this.consumerChannel) {
            this.logger().warn(
                `Message ${message.fields.deliveryTag} from "${message.fields.exchange}" was not settled because its channel is closed, the broker will redeliver it`,
            );
            return;
        }

        try {
            operation(channel);
        } catch (e) {
            this.logger().warn(`Message ${message.fields.deliveryTag} from "${message.fields.exchange}" was not settled: [${(e as Error).message}]`);
        }
    }
}

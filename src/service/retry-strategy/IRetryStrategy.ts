import type { Channel } from 'amqplib';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper, RetryStrategyEnum } from '../../interface';

export interface IRetryStrategy {
    readonly strategy: RetryStrategyEnum;

    /**
     * Declares the exchanges and queues shared by the handlers that use this strategy. The consumer runs it on a
     * short-lived channel after every connect, and retries it when a declaration fails
     */
    setupInfrastructure(channel: Channel, wrappersWithRetryStrategy: IHandlerWrapper[]): Promise<void>;

    /**
     * Binds a handler's queue, so that its retried messages are routed back to it. It runs as part of the handler's
     * set-up, so a queue that is declared again, for example after it was deleted, gets the binding back
     */
    bindQueue(channel: Channel, handlerWrapper: IHandlerWrapper): Promise<void>;

    /**
     * Publishes a failed message again, to be delivered to the handler's queue after a delay
     */
    requeue(channelWrapper: IChannelWrapper, handlerWrapper: IHandlerWrapper, event: AbstractSubscriptionEvent<any>): Promise<void>;
}

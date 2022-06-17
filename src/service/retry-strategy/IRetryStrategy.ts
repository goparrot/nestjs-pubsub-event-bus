import type { ChannelWrapper } from 'amqp-connection-manager';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper, RetryStrategyEnum } from '../../interface';

export interface IRetryStrategy {
    readonly strategy: RetryStrategyEnum;

    setupInfrastructure(channelWrapper: ChannelWrapper, wrappersWithRetryStrategy: IHandlerWrapper[]): Promise<void>;

    requeue(channelWrapper: IChannelWrapper, handlerWrapper: IHandlerWrapper, event: AbstractSubscriptionEvent<any>): Promise<void>;
}

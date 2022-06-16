import type { ChannelWrapper } from 'amqp-connection-manager';
import type { IHandlerWrapper, RetryStrategyEnum, IChannelWrapper } from '../../interface';

export interface IRetryStrategy {
    readonly strategy: RetryStrategyEnum;

    setupInfrastructure(channelWrapper: ChannelWrapper, wrappersWithRetryStrategy: IHandlerWrapper[]): Promise<void>;

    wrapHandler(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void;
}

import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ChannelWrapper, Options } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { DefaultedRetryOptions, ExchangeOptions, RetryStrategyEnum } from '../../interface';
import { LoggerProvider } from '../../provider';
import { CQRS_EXCHANGE_CONFIG, CQRS_RETRY_OPTIONS } from '../../utils/configuration';
import { DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, ORIGIN_EXCHANGE_HEADER, RETRY_COUNT_HEADER } from '../../utils/retry-constants';
import { calculateDelay, getMessageExchange } from '../../utils';
import type { IRetryStrategy } from './IRetryStrategy';

@Injectable()
export class DelayedMessageExchangeRetryStrategy implements IRetryStrategy {
    readonly strategy = RetryStrategyEnum.DELAYED_MESSAGE_EXCHANGE;

    constructor(
        @Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: DefaultedRetryOptions,
        @Inject(CQRS_EXCHANGE_CONFIG) protected readonly assertExchangeOptions: ExchangeOptions,
    ) {}

    private get logger(): LoggerService {
        return LoggerProvider.logger;
    }

    async setupInfrastructure(channelWrapper: ChannelWrapper, wrappersWithRetryStrategy: IHandlerWrapper[]): Promise<void> {
        const delayedExchangeOptions: Options.AssertExchange = {
            ...this.assertExchangeOptions,
            arguments: { ...this.assertExchangeOptions.arguments, 'x-delayed-type': 'direct' },
        };

        await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                channel.assertExchange(DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, 'x-delayed-message', delayedExchangeOptions),
                ...wrappersWithRetryStrategy.map(async (handlerWrapper: IHandlerWrapper) => {
                    const { queue } = handlerWrapper;
                    return channel.bindQueue(queue, DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, queue);
                }),
            ]);

            this.logger.log(`Delayed message auto retry exchange "${DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME}" asserted`);
        });
    }

    async requeue(channelWrapper: IChannelWrapper, handlerWrapper: IHandlerWrapper, event: AbstractSubscriptionEvent<any>): Promise<void> {
        const {
            handler,
            queue,
            options: { retryOptions },
        } = handlerWrapper;

        const message = event.message();
        if (!message) {
            return;
        }

        const { delay = this.rootRetryOptions.delay } = retryOptions ?? {};

        const retryCount = event.retryCount + 1;
        const delayValue = calculateDelay(delay, retryCount);

        await channelWrapper.publish(DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, queue, event.payload, {
            ...message.properties,
            type: message.properties.type,
            headers: {
                ...message.properties.headers,
                'x-delay': delayValue,
                [RETRY_COUNT_HEADER]: retryCount,
                [ORIGIN_EXCHANGE_HEADER]: getMessageExchange(message),
            },
        });

        this.logger.log(`Event ${event.constructor.name} was republished to "${queue}" queue with ${delayValue} ms delay`, handler.name);
    }
}

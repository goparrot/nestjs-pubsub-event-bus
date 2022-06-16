import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ChannelWrapper, Options } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { IEventHandler } from '@nestjs/cqrs';
import type { IHandlerWrapper, AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, IChannelWrapper } from '../../interface';
import { ExchangeOptions, IRetryOptions, RetryStrategyEnum } from '../../interface';
import { LoggerProvider } from '../../provider';
import { CQRS_EXCHANGE_CONFIG, CQRS_RETRY_OPTIONS } from '../../utils/configuration';
import { DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, ORIGIN_EXCHANGE_HEADER, RETRY_COUNT_HEADER } from '../../utils/retry-constants';
import { calculateDelay } from '../../utils';
import type { IRetryStrategy } from './IRetryStrategy';

@Injectable()
export class DelayedMessageExchangeRetryStrategy implements IRetryStrategy {
    readonly strategy = RetryStrategyEnum.DELAYED_MESSAGE_EXCHANGE;

    constructor(
        @Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: IRetryOptions,
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

    private async requeueMessageIfRequired(
        event: AbstractSubscriptionEvent<any>,
        handlerWrapper: IHandlerWrapper,
        channelWrapper: IChannelWrapper,
        onRetryAttemptsExceeded?: (event: AbstractSubscriptionEvent<any>) => Promise<void>,
    ): Promise<void> {
        const {
            handler,
            queue,
            options: { retryOptions },
        } = handlerWrapper;

        const message = event.message();
        if (!message) {
            return;
        }

        const { maxRetryAttempts = this.rootRetryOptions.maxRetryAttempts ?? 0, delay = this.rootRetryOptions.delay } = retryOptions ?? {};

        let retryCount = event.retryCount;

        if (retryCount > maxRetryAttempts) {
            await onRetryAttemptsExceeded?.(event);
            this.logger.warn(`Maximum number of retry attempts (${maxRetryAttempts}) exceeded. Discarded message: ${JSON.stringify(event)}`, handler.name);
            return;
        }
        retryCount++;

        const delayValue = calculateDelay(delay, retryCount);
        const headers = {
            ...message.properties.headers,
            'x-delay': delayValue,
            [RETRY_COUNT_HEADER]: retryCount,
            [ORIGIN_EXCHANGE_HEADER]: message.properties.headers[ORIGIN_EXCHANGE_HEADER] ?? message.fields.exchange,
        };

        await channelWrapper.publish(DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, queue, event.payload, {
            ...message.properties,
            type: message.properties.type,
            headers,
        });

        this.logger.log(`Event ${event.constructor.name} was republished to "${queue}" queue with ${delayValue} ms delay`, handler.name);
    }

    wrapHandler(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const { handler } = handlerWrapper;
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;

        const requeueMessageIfRequired = this.requeueMessageIfRequired.bind(this);

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } catch (error) {
                    await requeueMessageIfRequired(event, handlerWrapper, channelWrapper, async (event: AbstractSubscriptionEvent<any>) => {
                        return (this as AbstractPubsubAnyEventHandler).onRetryAttemptsExceeded?.(event, error);
                    });
                } finally {
                    const message = event.message();
                    if (message) {
                        channelWrapper.ack(message);
                    }
                }
            },
        });
    }
}

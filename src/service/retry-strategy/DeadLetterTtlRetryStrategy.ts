import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { chain, times } from 'lodash';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { BindingQueueOptions, DefaultedRetryOptions, ExchangeOptions, RetryStrategyEnum } from '../../interface';
import { LoggerProvider } from '../../provider';
import { CQRS_BINDING_QUEUE_CONFIG, CQRS_EXCHANGE_CONFIG, CQRS_RETRY_OPTIONS } from '../../utils/configuration';
import {
    DEFAULT_DELAY_QUEUE_NAME_PREFIX,
    DEFAULT_RETRY_DELAY_EXCHANGE_NAME,
    DEFAULT_RETRY_REQUEUE_EXCHANGE_NAME,
    ORIGIN_EXCHANGE_HEADER,
    RETRY_COUNT_HEADER,
} from '../../utils/retry-constants';
import { calculateDelay, getMessageExchange } from '../../utils';
import type { IRetryStrategy } from './IRetryStrategy';

@Injectable()
export class DeadLetterTtlRetryStrategy implements IRetryStrategy {
    readonly strategy = RetryStrategyEnum.DEAD_LETTER_TTL;

    constructor(
        @Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: DefaultedRetryOptions,
        @Inject(CQRS_EXCHANGE_CONFIG) protected readonly assertExchangeOptions: ExchangeOptions,
        @Inject(CQRS_BINDING_QUEUE_CONFIG) private readonly bindingQueueOptions: BindingQueueOptions,
    ) {}

    private get logger(): LoggerService {
        return LoggerProvider.logger;
    }

    async setupInfrastructure(channelWrapper: ChannelWrapper, wrappersWithRetryStrategy: IHandlerWrapper[]): Promise<void> {
        const delays = chain(wrappersWithRetryStrategy)
            .flatMap((wrapper: IHandlerWrapper) => {
                const { delay = this.rootRetryOptions.delay, maxRetryAttempts = this.rootRetryOptions.maxRetryAttempts } = wrapper.options.retryOptions ?? {};

                return times(maxRetryAttempts, (retryCount: number) => calculateDelay(delay, retryCount + 1));
            })
            .uniq()
            .value();

        await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
            await Promise.all([
                channel
                    .assertExchange(DEFAULT_RETRY_DELAY_EXCHANGE_NAME, 'topic', this.assertExchangeOptions)
                    .then(() => this.logger.log(`Delay auto retry exchange "${DEFAULT_RETRY_DELAY_EXCHANGE_NAME}" asserted`)),
                channel
                    .assertExchange(DEFAULT_RETRY_REQUEUE_EXCHANGE_NAME, 'topic', this.assertExchangeOptions)
                    .then(() => this.logger.log(`Requeue auto retry exchange "${DEFAULT_RETRY_REQUEUE_EXCHANGE_NAME}" asserted`)),
                ...delays.map(async (delay: number) => {
                    const queue = `${DEFAULT_DELAY_QUEUE_NAME_PREFIX}.${delay}`;

                    await channel.assertQueue(queue, {
                        ...this.bindingQueueOptions,
                        messageTtl: delay,
                        deadLetterExchange: DEFAULT_RETRY_REQUEUE_EXCHANGE_NAME,
                    });
                    await channel.bindQueue(queue, DEFAULT_RETRY_DELAY_EXCHANGE_NAME, `#.retry.${delay}`);

                    this.logger.log(`Delay queue asserted "${queue}" asserted`);
                }),
                ...wrappersWithRetryStrategy.map(async (handlerWrapper: IHandlerWrapper) => {
                    const { queue } = handlerWrapper;
                    await channel.bindQueue(queue, DEFAULT_RETRY_REQUEUE_EXCHANGE_NAME, `${queue}.#`);
                }),
            ]);
        });
    }

    async requeue(channelWrapper: IChannelWrapper, handlerWrapper: IHandlerWrapper, event: AbstractSubscriptionEvent<any>): Promise<void> {
        const {
            queue,
            handler,
            options: { retryOptions },
        } = handlerWrapper;

        const message = event.message();
        if (!message) {
            return;
        }

        const { delay = this.rootRetryOptions.delay } = retryOptions ?? {};

        const retryCount = event.retryCount + 1;
        const delayValue = calculateDelay(delay, retryCount);

        const routingKey = `${queue}.retry.${delayValue}`;

        await channelWrapper.publish(DEFAULT_RETRY_DELAY_EXCHANGE_NAME, routingKey, event.payload, {
            ...message.properties,
            type: message.properties.type,
            headers: {
                ...message.properties.headers,
                [RETRY_COUNT_HEADER]: retryCount,
                [ORIGIN_EXCHANGE_HEADER]: getMessageExchange(message),
            },
        });

        this.logger.log(`Event ${event.constructor.name} was republished to "${queue}" queue with ${delayValue} ms delay`, handler.name);
    }
}

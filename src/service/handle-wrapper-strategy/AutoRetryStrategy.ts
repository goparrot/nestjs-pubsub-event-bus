import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AutoAckEnum, DefaultedRetryOptions, ExchangeOptions } from '../../interface';
import { CQRS_RETRY_STRATEGIES, RetryStrategies } from '../../provider';
import { CQRS_EXCHANGE_CONFIG, CQRS_RETRY_OPTIONS } from '../../utils/configuration';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class AutoRetryStrategy extends AbstractHandleWrapperStrategy {
    readonly strategy = AutoAckEnum.AUTO_RETRY;

    constructor(
        @Inject(CQRS_RETRY_STRATEGIES) private readonly retryStrategies: RetryStrategies,
        @Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: DefaultedRetryOptions,
        @Inject(CQRS_EXCHANGE_CONFIG) protected readonly assertExchangeOptions: ExchangeOptions,
    ) {
        super();
    }

    process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const {
            handler,
            options: { retryOptions },
        } = handlerWrapper;

        const { maxRetryAttempts = this.rootRetryOptions.maxRetryAttempts, strategy = this.rootRetryOptions.strategy } = retryOptions ?? {};

        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;
        const retryStrategy = this.retryStrategies[strategy];
        const logger = this.logger;

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } catch (error) {
                    if (event.retryCount >= maxRetryAttempts) {
                        await (this as AbstractPubsubAnyEventHandler).onRetryAttemptsExceeded?.(event, error);
                        logger.warn(
                            `Maximum number of retry attempts (${maxRetryAttempts}) exceeded. Discarded message: ${JSON.stringify(event)}`,
                            handler.name,
                        );
                        return;
                    }

                    await retryStrategy.requeue(channelWrapper, handlerWrapper, event);
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

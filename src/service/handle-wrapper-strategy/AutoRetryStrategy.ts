import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AutoAckEnum, IRetryOptions } from '../../interface';
import { calculateDelay, generateQueueName } from '../../utils';
import { CQRS_RETRY_OPTIONS } from '../../utils/configuration';
import { DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, ORIGIN_EXCHANGE_HEADER, RETRY_COUNT_HEADER } from '../../utils/retry-constants';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class AutoRetryStrategy extends AbstractHandleWrapperStrategy {
    readonly strategy = AutoAckEnum.AUTO_RETRY;

    constructor(@Inject(CQRS_RETRY_OPTIONS) private readonly rootRetryOptions: IRetryOptions) {
        super();
    }

    private async requeueMessageIfRequired(
        event: AbstractSubscriptionEvent<any>,
        handlerWrapper: IHandlerWrapper,
        channelWrapper: IChannelWrapper,
    ): Promise<void> {
        const {
            handler,
            options: { retryOptions, queue = generateQueueName(handler) },
        } = handlerWrapper;

        const message = event.message();
        if (!message) {
            return;
        }

        const { maxRetryCount = this.rootRetryOptions.maxRetryCount ?? 0, delay = this.rootRetryOptions.delay } = retryOptions ?? {};
        const currentRetryCount = event.retryCount;

        if (currentRetryCount > maxRetryCount) {
            this.logger.warn(`Maximum number of retry attempts (${maxRetryCount}) exceeded. Discarded message: ${JSON.stringify(event)}`, handler.name);
            return;
        }
        const newRetryCount = currentRetryCount + 1;
        const delayValue = calculateDelay(delay, newRetryCount);
        const headers = {
            ...message.properties.headers,
            'x-delay': delayValue,
            [RETRY_COUNT_HEADER]: newRetryCount,
            [ORIGIN_EXCHANGE_HEADER]: message.properties.headers[ORIGIN_EXCHANGE_HEADER] ?? message.fields.exchange,
        };

        await channelWrapper.publish(DEFAULT_RETRY_DELAYED_MESSAGE_EXCHANGE_NAME, queue, event.payload, {
            ...message.properties,
            type: message.properties.type,
            headers,
        });

        this.logger.log(`Event ${event.constructor.name} was republished to "${queue}" queue with ${delayValue} ms delay`, handler.name);
    }

    private addAutoRetry(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const { handler } = handlerWrapper;
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;

        const requeueMessageIfRequired = this.requeueMessageIfRequired.bind(this);

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } finally {
                    const message = event.message();
                    if (message) {
                        channelWrapper.ack(message);

                        await requeueMessageIfRequired(event, handlerWrapper, channelWrapper);
                    }
                }
            },
        });
    }

    process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        this.addAutoRetry(handlerWrapper, channelWrapper);
    }
}

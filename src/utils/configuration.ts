import type { AmqpConnectionManagerOptions } from 'amqp-connection-manager';
import type { BindingQueueOptions, ExchangeOptions, IConsumerOptions, PublishOptions, DefaultedRetryOptions } from '../interface';
import { RetryStrategyEnum } from '../interface';

export const CQRS_MODULE_CONSUMER_OPTIONS = 'CQRS_MODULE_CONSUMER_OPTIONS';
export const CQRS_MODULE_OPTIONS = 'CQRS_MODULE_OPTIONS';
export const CQRS_CONNECTION_NAME = 'CQRS_CONNECTION_NAME';
export const CQRS_CONNECTION_URLS = 'CQRS_CONNECTION_URLS';
export const CQRS_EXCHANGE_CONFIG = 'CQRS_EXCHANGE_CONFIG';
export const CQRS_PRODUCER_CONFIG = 'CQRS_PRODUCER_CONFIG';
export const CQRS_BINDING_QUEUE_CONFIG = 'CQRS_BINDING_QUEUE_CONFIG';
export const CQRS_CONNECTION_MANAGER_OPTIONS = 'CQRS_CONNECTION_MANAGER_OPTIONS';
export const CQRS_RETRY_OPTIONS = 'CQRS_RETRY_OPTIONS';

export const FAN_OUT_BINDING = '#';

export const DEFAULT_EXCHANGE_CONFIGURATION: ExchangeOptions = {
    durable: true,
    autoDelete: false,
};

export const DEFAULT_PRODUCER_CONFIGURATION: PublishOptions = {
    deliveryMode: 2,
    contentType: 'application/json',
};

export const DEFAULT_QUEUE_BINDING_CONFIGURATION: BindingQueueOptions = {
    durable: true,
    autoDelete: false,
};

export const DEFAULT_CONSUMER_OPTIONS: IConsumerOptions = {
    prefetchPerConsumer: 10,
    prefetchPerChannel: 100,
};

export const DEFAULT_RETRY_OPTIONS: DefaultedRetryOptions = {
    maxRetryAttempts: 3,
    strategy: RetryStrategyEnum.DEAD_LETTER_TTL,
    delay: (retryCount: number) => Math.floor(1000 * Math.exp(retryCount - 1)),
};

export const DEFAULT_CONNECTION_MANAGER_OPTIONS: AmqpConnectionManagerOptions = {};

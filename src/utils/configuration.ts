import type { BindingQueueOptions, ExchangeOptions, IConsumerOptions, PublishOptions, PubsubExchangeType } from '../interface';

export const DEFAULT_EXCHANGE_TYPE: PubsubExchangeType = 'topic';

export const CQRS_MODULE_CONSUMER_OPTIONS = 'CQRS_MODULE_CONSUMER_OPTIONS';
export const CQRS_MODULE_OPTIONS = 'CQRS_MODULE_OPTIONS';
export const CQRS_CONNECTION_NAME = 'CQRS_CONNECTION_NAME';

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
};

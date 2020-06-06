import { BindingQueueOptions, ExchangeOptions, PublishOptions, PubsubExchangeType } from '../interface';

export const DEFAULT_EXCHANGE_TYPE: PubsubExchangeType = 'topic';

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

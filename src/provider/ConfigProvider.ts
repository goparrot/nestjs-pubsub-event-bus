import type { BindingQueueOptions, ExchangeOptions, ICqrsModuleOptions, PublishOptions, PubsubExchangeType } from '../interface';
import {
    DEFAULT_EXCHANGE_CONFIGURATION,
    DEFAULT_EXCHANGE_TYPE,
    DEFAULT_PRODUCER_CONFIGURATION,
    DEFAULT_QUEUE_BINDING_CONFIGURATION,
} from '../utils/configuration';

export class ConfigProvider {
    static exchange: ExchangeOptions;
    static producer: PublishOptions;
    static bindings: BindingQueueOptions;
    static exchangeType: PubsubExchangeType;

    static fromOptions(options: ICqrsModuleOptions): ConfigProvider {
        ConfigProvider.exchange = options.config?.exchange || DEFAULT_EXCHANGE_CONFIGURATION;
        ConfigProvider.producer = options.config?.producer || DEFAULT_PRODUCER_CONFIGURATION;
        ConfigProvider.bindings = options.config?.bindings || DEFAULT_QUEUE_BINDING_CONFIGURATION;
        ConfigProvider.exchangeType = options.exchangeType || DEFAULT_EXCHANGE_TYPE;

        return new ConfigProvider();
    }
}

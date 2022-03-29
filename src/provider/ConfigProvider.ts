import type { BindingQueueOptions, ICqrsModuleOptions, PublishOptions } from '../interface';
import { DEFAULT_PRODUCER_CONFIGURATION, DEFAULT_QUEUE_BINDING_CONFIGURATION } from '../utils/configuration';

export class ConfigProvider {
    static producer: PublishOptions;
    static bindings: BindingQueueOptions;

    static fromOptions(options: ICqrsModuleOptions): ConfigProvider {
        ConfigProvider.producer = options.config?.producer || DEFAULT_PRODUCER_CONFIGURATION;
        ConfigProvider.bindings = options.config?.bindings || DEFAULT_QUEUE_BINDING_CONFIGURATION;

        return new ConfigProvider();
    }
}

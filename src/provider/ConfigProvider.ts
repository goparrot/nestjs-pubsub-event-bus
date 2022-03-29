import type { BindingQueueOptions, ICqrsModuleOptions } from '../interface';
import { DEFAULT_QUEUE_BINDING_CONFIGURATION } from '../utils/configuration';

export class ConfigProvider {
    static bindings: BindingQueueOptions;

    static fromOptions(options: ICqrsModuleOptions): ConfigProvider {
        ConfigProvider.bindings = options.config?.bindings || DEFAULT_QUEUE_BINDING_CONFIGURATION;

        return new ConfigProvider();
    }
}

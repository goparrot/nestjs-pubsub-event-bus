import { LoggerService } from '@nestjs/common';
import { PublishOptions } from './PublishOptions';
import { BindingQueueOptions } from './BindingQueueOptions';
import { PubsubExchangeType } from './PubsubExchangeType';
import { ExchangeOptions } from './ExchangeOptions';

interface ICqrsModuleOptionsConfig {
    exchange?: ExchangeOptions;
    producer?: PublishOptions;
    bindings?: BindingQueueOptions;
}

export interface ICqrsModuleOptions {
    connections: string[];

    exchangeType?: PubsubExchangeType;

    config?: ICqrsModuleOptionsConfig;

    /**
     * If "true", registers `CqrsModule` as a global module.
     * See: https://docs.nestjs.com/modules#global-modules
     */
    isGlobal?: boolean;

    logger?: LoggerService;
}

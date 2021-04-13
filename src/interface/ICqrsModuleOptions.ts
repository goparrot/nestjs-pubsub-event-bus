import type { LoggerService } from '@nestjs/common';
import type { BindingQueueOptions } from './BindingQueueOptions';
import type { ExchangeOptions } from './ExchangeOptions';
import type { IConsumerOptions } from './IConsumerOptions';
import type { PublishOptions } from './PublishOptions';
import type { PubsubExchangeType } from './PubsubExchangeType';

interface ICqrsModuleOptionsConfig {
    exchange?: ExchangeOptions;
    consumer?: IConsumerOptions;
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

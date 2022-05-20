import type { LoggerService } from '@nestjs/common';
import type { AmqpConnectionManagerOptions } from 'amqp-connection-manager';
import type { BindingQueueOptions } from './BindingQueueOptions';
import type { ExchangeOptions } from './ExchangeOptions';
import type { IConsumerOptions } from './IConsumerOptions';
import type { IRetryOptions } from './IRetryOptions';
import type { PublishOptions } from './PublishOptions';

interface ICqrsModuleOptionsConfig {
    exchange?: ExchangeOptions;
    consumer?: IConsumerOptions;
    producer?: PublishOptions;
    bindings?: BindingQueueOptions;
    connectionManagerOptions?: AmqpConnectionManagerOptions;
}

export interface ICqrsModuleOptions {
    connections: string[];

    config?: ICqrsModuleOptionsConfig;

    /**
     * If "true", registers `CqrsModule` as a global module.
     * See: https://docs.nestjs.com/modules#global-modules
     */
    isGlobal?: boolean;

    logger?: LoggerService;

    /**
     * Name of the connection to be displayed in the server logs and management UI. Final name will have a suffix `:producer` or `:consumer` depending on the
     * connection purpose
     * @example `service-name-${uuid.v4()}`
     */
    connectionName?: string;

    /**
     * Handler specific retry options. Specific options are merged with the global ones
     */
    retryOptions?: IRetryOptions;
}

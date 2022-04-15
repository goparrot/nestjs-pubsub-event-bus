import type { LoggerService, OnModuleDestroy } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import type { AmqpConnectionManager, ChannelWrapper, ConnectionUrl } from 'amqp-connection-manager';
import * as RabbitManager from 'amqp-connection-manager';
import { AmqpConnectionManagerOptions } from 'amqp-connection-manager';
import type { ConfirmChannel, Options as AmqpOptions } from 'amqplib';
import { cloneDeep, set } from 'lodash';
import { ExchangeOptions } from '../interface';
import { LoggerProvider } from '../provider';
import { CQRS_CONNECTION_MANAGER_OPTIONS, CQRS_CONNECTION_NAME, CQRS_CONNECTION_URLS, CQRS_EXCHANGE_CONFIG } from '../utils/configuration';

/**
 * Review the work with connections & channels, according to these recommendations.
 * https://www.cloudamqp.com/blog/2018-01-19-part4-rabbitmq-13-common-errors.html
 */
export abstract class PubsubManager implements OnModuleDestroy {
    private connection$: AmqpConnectionManager | undefined;

    @Inject(CQRS_CONNECTION_NAME)
    @Optional()
    private readonly connectionName?: string;

    @Inject(CQRS_CONNECTION_URLS)
    private readonly urls: ConnectionUrl | ConnectionUrl[];

    @Inject(CQRS_EXCHANGE_CONFIG)
    private readonly assertExchangeOptions: ExchangeOptions;

    @Inject(CQRS_CONNECTION_MANAGER_OPTIONS)
    private readonly connectionManagerOptions: AmqpConnectionManagerOptions;

    protected get connection(): AmqpConnectionManager {
        if (!this.connection$) {
            throw new Error('Amqp connection has not been initialized');
        }
        return this.connection$;
    }

    private channelWrapper$: ChannelWrapper | undefined;

    protected get channelWrapper(): ChannelWrapper {
        if (!this.channelWrapper$) {
            throw new Error('Amqp channel has not been initialized');
        }
        return this.channelWrapper$;
    }

    async setupChannel(_channel: ConfirmChannel): Promise<void> {}

    protected initConnectionIfRequired(): void {
        if (this.connection$) {
            return;
        }

        const options: AmqpConnectionManagerOptions = cloneDeep(this.connectionManagerOptions);

        if (!options.connectionOptions?.clientProperties.connection_name && this.connectionName) {
            const connectionName = `${this.connectionName}:${this.constructor.name.toLowerCase()}`;

            set(options, 'connectionOptions.clientProperties.connection_name', connectionName);
        }

        this.connection$ = RabbitManager.connect(this.urls, options)
            .on('connect', () => this.logger().log('Amqp connection established', this.constructor.name))
            .on('disconnect', (arg: { err: Error }) => this.logger().error(arg.err.message, undefined, this.constructor.name))
            .on('connectFailed', (arg: { err: Error; url: string | AmqpOptions.Connect | undefined }) =>
                this.logger().error(arg.err.message, undefined, this.constructor.name),
            )
            .on('blocked', (arg: { reason: string }) => this.logger().error(`Connection blocked, ${arg.reason}`, undefined, this.constructor.name))
            .on('unblocked', () => this.logger().log('Connection unblocked', this.constructor.name));
    }

    protected initChannelIfRequired(): void {
        if (this.channelWrapper$) {
            return;
        }

        this.channelWrapper$ = this.connection
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .createChannel({ json: true, setup: this.setupChannel.bind(this) })
            .on('connect', () => this.logger().log(`Amqp channel created`, this.constructor.name))
            .on('error', (err: Error, { name }: { name?: string }) =>
                this.logger().error(`Amqp channel error: ${err.message}`, err.stack, name ?? this.constructor.name),
            )
            .on('close', () => this.logger().log(`Amqp channel closed`, this.constructor.name));
    }

    async onModuleDestroy(): Promise<void> {
        await this.channelWrapper$?.close();
        await this.connection$?.close();
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected exchangeOptions(extra: ExchangeOptions = {}): ExchangeOptions {
        return { ...this.assertExchangeOptions, ...extra };
    }

    protected appInTestingMode = (): boolean => process.env.NODE_ENV === 'test';
}

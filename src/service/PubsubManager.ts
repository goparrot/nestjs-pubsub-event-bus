import type { LoggerService, OnModuleDestroy } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import type { AmqpConnectionManager, AmqpConnectionManagerOptions, ChannelWrapper } from 'amqp-connection-manager';
import * as RabbitManager from 'amqp-connection-manager';
import type { ConfirmChannel, Options as AmqpOptions } from 'amqplib';
import { set } from 'lodash';
import type { ExchangeOptions } from '../interface';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from '../provider';
import { CQRS_CONNECTION_NAME } from '../utils/configuration';

/**
 * Review the work with connections & channels, according to these recommendations.
 * https://www.cloudamqp.com/blog/2018-01-19-part4-rabbitmq-13-common-errors.html
 */
export abstract class PubsubManager implements OnModuleDestroy {
    private connection$: AmqpConnectionManager | undefined;

    @Inject(CQRS_CONNECTION_NAME)
    @Optional()
    private readonly connectionName?: string;

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

        const options: AmqpConnectionManagerOptions = {
            heartbeatIntervalInSeconds: 5,
            reconnectTimeInSeconds: 5,
        };

        if (this.connectionName) {
            const connectionName = `${this.connectionName}:${this.constructor.name.toLowerCase()}`;

            set(options, 'connectionOptions.clientProperties.connection_name', connectionName);
        }

        this.connection$ = RabbitManager.connect(ConnectionProvider.connections, options)
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
        return {
            ...ConfigProvider.exchange,
            ...extra,
        };
    }

    protected appInTestingMode = (): boolean => process.env.NODE_ENV === 'test';
}

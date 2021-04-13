import type { LoggerService, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import * as RabbitManager from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { ExchangeOptions } from '../interface';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from '../provider';

/**
 * Review the work with connections & channels, according to these recommendations.
 * https://www.cloudamqp.com/blog/2018-01-19-part4-rabbitmq-13-common-errors.html
 */
export abstract class PubsubManager implements OnModuleInit, OnModuleDestroy {
    protected connection$: AmqpConnectionManager;
    protected channelWrapper$: ChannelWrapper;

    async setupChannel(_channel: ConfirmChannel): Promise<void> {}

    async onModuleInit(): Promise<void> {
        if (this.appInTestingMode()) return;

        this.connection$ = RabbitManager.connect(ConnectionProvider.connections, {
            heartbeatIntervalInSeconds: 5,
            reconnectTimeInSeconds: 5,
        })
            .on('connect', () => void this.logger().log(`Amqp connection established`))
            .on('disconnect', (arg: { err: Error }) => void this.logger().error(arg.err.message));

        this.channelWrapper$ = this.connection$
            .createChannel({ json: true, setup: this.setupChannel.bind(this) })
            .on('connect', () => void this.logger().log(`Amqp channel created`))
            .on('error', (err: Error, { name }: { name: string }) => void this.logger().error(`Amqp channel error: ${err.message}`, err.stack, name))
            .on('close', () => void this.logger().log(`Amqp channel closes`));
    }

    async onModuleDestroy(): Promise<void> {
        this.channelWrapper$ && (await this.channelWrapper$.close());
        this.connection$ && (await this.connection$.close());
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

    protected appInTestingMode = (): boolean => process.env.NODE_ENV! === 'test';
}

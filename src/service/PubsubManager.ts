import * as RabbitManager from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { LoggerService, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from '../provider';
import { ExchangeOptions } from '../interface';

/**
 * Review the work with connections & channels, according to these recommendations.
 * https://www.cloudamqp.com/blog/2018-01-19-part4-rabbitmq-13-common-errors.html
 */
export abstract class PubsubManager implements OnModuleInit, OnModuleDestroy {
    protected connection$: AmqpConnectionManager;
    protected channelWrapper$: ChannelWrapper;

    async onModuleInit(): Promise<void> {
        if (this.appInTestingMode()) return;

        this.connection$ = RabbitManager.connect(ConnectionProvider.connections, {
            heartbeatIntervalInSeconds: 5,
            reconnectTimeInSeconds: 5,
        })
            .on('connect', () => void this.logger().log(`Amqp connection established`))
            .on('disconnect', (arg: { err: Error }) => void this.logger().error(arg.err.message));

        this.channelWrapper$ = this.connection$
            .createChannel({ json: true })
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

    protected async channel(exchange: string, onExchangeCreated?: (channel: ConfirmChannel) => unknown): Promise<void> {
        void this.connection$
            .createChannel({
                json: true,
                setup: async (channel: ConfirmChannel): Promise<any> =>
                    Promise.all([
                        channel.assertExchange(exchange, 'topic', this.exchangeOptions()),
                        ...(onExchangeCreated ? [onExchangeCreated(channel)] : []),
                    ]),
            })
            .waitForConnect()
            .then((): void => void this.logger().log(`Listening for "${exchange}" messages`));

        return;
    }

    protected exchangeOptions(extra: ExchangeOptions = {}): ExchangeOptions {
        return {
            ...ConfigProvider.exchange,
            ...extra,
        };
    }

    private appInTestingMode = (): boolean => 'test' === process.env.NODE_ENV!;
}

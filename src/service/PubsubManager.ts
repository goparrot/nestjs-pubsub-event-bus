import * as RabbitManager from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { LoggerService, OnModuleDestroy } from '@nestjs/common';
import { ConfigProvider, ConnectionProvider, LoggerProvider } from '../provider';
import { ExchangeOptions } from '../interface';

export abstract class PubsubManager implements OnModuleDestroy {
    protected connection: AmqpConnectionManager;

    async onModuleDestroy(): Promise<any> {
        this.connection && (await this.connection.close());
    }

    protected logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected async channel(exchange: string, onExchangeCreated?: (channel: ConfirmChannel) => any): Promise<ChannelWrapper> {
        if (!this.connection?.isConnected()) {
            this.connection = RabbitManager.connect(ConnectionProvider.connections, {
                heartbeatIntervalInSeconds: 5,
                reconnectTimeInSeconds: 5,
            });

            this.connection.on('disconnect', (arg: { err: Error }) => {
                // Connection handler uses auto-retries mechanism.
                // So far, this is the only way to ensure, the connection was established.
                this.logger().error(arg.err.message);
            });
        }

        return this.connection.createChannel({
            json: true,
            setup: async (channel: ConfirmChannel): Promise<any> => {
                await channel.assertExchange(exchange, 'topic', this.exchangeOptions());

                onExchangeCreated && onExchangeCreated(channel);
            },
        });
    }

    protected exchangeOptions(extra: ExchangeOptions = {}): ExchangeOptions {
        return {
            ...ConfigProvider.exchange,
            ...extra,
        };
    }
}

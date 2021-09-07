import type { ConfirmChannel } from 'amqplib';
import type { PublishOptions } from '../interface';
import { ConfigProvider } from '../provider';
import { PubsubManager } from './PubsubManager';

export class Producer extends PubsubManager {
    /**
     * Set of exchanges where messages are published to
     */
    private readonly exchanges: Set<string> = new Set<string>();

    /**
     * Produce an event.
     * @param event - event name (Ex.: store.created, user.updated, order.cancelled, etc...)
     * @param payload - message payload
     * @param exchange - exchange name
     * @param publishHeaders - custom message headers
     */
    async produce(event: string, payload: Record<string, any> | Buffer, exchange: string, publishHeaders?: PublishOptions): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }

        const headers: PublishOptions = { ...this.headers(publishHeaders), type: event };

        const message: string = `Event "${event}" to "${exchange}" with ${JSON.stringify({ payload, headers })}`;

        if (!this.exchanges.has(exchange)) {
            await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => channel.assertExchange(exchange, 'topic', this.exchangeOptions()));
            this.exchanges.add(exchange);
        }

        try {
            await this.channelWrapper.publish(exchange, event, payload, headers);
            this.logger().log(`${message} -> PUBLISHED.`);
        } catch (e) {
            this.logger().error(`${message} -> UNPUBLISHED -> [${(e as Error).message}]`);
        }
    }

    protected headers(extra?: PublishOptions): PublishOptions {
        return {
            ...this.producerConfiguration(),
            ...extra,
        };
    }

    protected producerConfiguration(): PublishOptions {
        return ConfigProvider.producer;
    }
}

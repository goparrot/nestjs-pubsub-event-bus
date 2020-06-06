import { ChannelWrapper } from 'amqp-connection-manager';
import { PublishOptions } from '../interface';
import { ConfigProvider } from '../provider';
import { PubsubManager } from './PubsubManager';

export class Producer extends PubsubManager {
    /**
     * Produce an event.
     * @param event - event name (Ex.: store.created, user.updated, order.cancelled, etc...)
     * @param payload - message payload
     * @param exchange - exchange name
     * @param publishHeaders - custom message headers
     */
    async produce(event: string, payload: Record<string, any> | Buffer, exchange: string, publishHeaders?: PublishOptions): Promise<void> {
        let channel: ChannelWrapper | undefined;
        const headers: PublishOptions = { ...this.headers(publishHeaders), type: event };

        this.logger().log(`Publish "${event}" to "${exchange}" with ${JSON.stringify({ payload, headers })}`);

        try {
            channel = await this.channel(exchange);
            await channel.publish(exchange, event, payload, headers);
        } catch (e) {
            this.logger().warn(`Unable to publish: [${(e as Error).message}]`);
        } finally {
            channel && (await channel.close());
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

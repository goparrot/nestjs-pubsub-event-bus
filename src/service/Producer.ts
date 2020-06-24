import { ConfirmChannel } from 'amqplib';
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
        const headers: PublishOptions = { ...this.headers(publishHeaders), type: event };

        await this.channel(exchange, (ch: ConfirmChannel): void => {
            const message: string = `Event "${event}" to "${exchange}" with ${JSON.stringify({
                payload,
                headers,
            })}`;

            ch.publish(exchange, event, Buffer.from(JSON.stringify(payload)), headers, (err: Error | undefined): void => {
                const isSuccess: boolean = !err;

                isSuccess ? this.logger().log(`${message} -> PUBLISHED.`) : this.logger().warn(`${message} -> UNPUBLISHED -> [${(err as Error).message}]`);

                ch && ch.close();
                this.connection && this.connection.close();
            });
        });
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

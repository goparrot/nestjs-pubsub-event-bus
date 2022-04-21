import type { Message } from 'amqplib';
import type { PublishOptions } from './PublishOptions';

export interface IChannelWrapper {
    ack(message: Message): void;

    nack(message: Message): void;

    publish(exchange: string, routingKey: string, content: Buffer | string | unknown, options?: PublishOptions): Promise<void>;
}

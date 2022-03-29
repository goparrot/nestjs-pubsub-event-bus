import type { Message } from 'amqplib';

export interface IChannelWrapper {
    ack(message: Message): void;

    nack(message: Message): void;
}

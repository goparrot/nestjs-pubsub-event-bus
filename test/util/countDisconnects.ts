import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { Consumer } from '../../src';

export function countDisconnects(consumer: Consumer): () => number {
    let disconnects = 0;
    (Reflect.get(consumer, 'connection') as AmqpConnectionManager).on('disconnect', () => disconnects++);

    return () => disconnects;
}

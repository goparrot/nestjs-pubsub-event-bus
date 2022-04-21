import type { IEvent } from '@nestjs/cqrs';
import type { Message } from 'amqplib';
import { RETRY_COUNT_HEADER } from '../utils/retry-constants';

export abstract class AbstractSubscriptionEvent<T extends Record<string, any> | Buffer> implements IEvent {
    #message: Message | undefined;

    constructor(readonly payload: T) {}

    message = (): Message | undefined => this.#message;

    withMessage = (message: Message): this => {
        this.#message = message;

        return this;
    };

    get retryCount(): number {
        return this.#message?.properties.headers[RETRY_COUNT_HEADER] ?? 0;
    }
}

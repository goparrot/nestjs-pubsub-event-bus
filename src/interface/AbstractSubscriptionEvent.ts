import type { IEvent } from '@nestjs/cqrs';
import type { Message } from 'amqplib';

export abstract class AbstractSubscriptionEvent<T extends Record<string, any> | Buffer> implements IEvent {
    #message: Message | undefined;

    constructor(readonly payload: T) {}

    message = (): Message | undefined => this.#message;

    withMessage = (message: Message): this => {
        this.#message = message;

        return this;
    };
}

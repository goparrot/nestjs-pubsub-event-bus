import type { Message } from 'amqplib';

export abstract class PubsubEventListener<T extends Record<string, any> | Buffer> {
    #message: Message | undefined;

    constructor(readonly payload: T) {}

    message = (): Message | undefined => this.#message;

    withMessage = (message: Message): this => {
        this.#message = message;

        return this;
    };
}

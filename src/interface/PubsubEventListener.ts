import type { Message } from 'amqplib';

export abstract class PubsubEventListener<T extends Record<string, any> | Buffer> {
    #message: Message | undefined;

    constructor(protected data: T) {}

    // Provide Event payload (data model).
    payload = (): T => this.data;

    message = (): Message | undefined => this.#message;

    withMessage = (message: Message): this => {
        this.#message = message;

        return this;
    };
}

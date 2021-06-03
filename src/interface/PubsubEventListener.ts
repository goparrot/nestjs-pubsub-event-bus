import type { Message } from 'amqplib';

export abstract class PubsubEventListener<T extends Record<string, any> | Buffer> {
    protected _message: Message | undefined;

    constructor(protected data: T) {}

    // Provide Event payload (data model).
    payload = (): T => this.data;

    message = (): Message | undefined => this._message;

    withMessage = (message: Message): this => {
        this._message = message;

        return this;
    };
}

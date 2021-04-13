import type { Message } from 'amqplib';
import type { PublishOptions } from './PublishOptions';

export abstract class PubsubEvent<T extends Record<string, any> | Buffer> {
    // Default publish options.
    protected options: PublishOptions = {};
    protected fireLocally: boolean = true;
    #message: Message | undefined;

    constructor(protected data: T) {}

    // Exchange name
    abstract exchange(): string;

    // Provide Event payload (data model).
    payload = (): T => this.data;

    // Get publish options.
    getOptions = (): PublishOptions => this.options;

    // Get local publishing option.
    localEventEnabled = (): boolean => this.fireLocally;

    message = (): Message | undefined => this.#message;

    // Set the publish options at runtime (overrides the default publish options).
    withOptions = (extra: PublishOptions): this => {
        this.options = { ...this.options, ...extra };

        return this;
    };

    withLocalEvent = (allow: boolean = true): this => {
        this.fireLocally = allow;

        return this;
    };

    withMessage = (message: Message): this => {
        this.#message = message;

        return this;
    };
}

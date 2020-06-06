import { PublishOptions } from './PublishOptions';

export abstract class PubsubEvent<T extends Record<string, any> | Buffer> {
    // Default publish options.
    protected options: PublishOptions = {};

    constructor(protected data: T) {}

    // Exchange name
    abstract exchange(): string;

    // Provide Event payload (data model).
    payload = (): T => this.data;

    // Get publish options.
    getOptions = (): PublishOptions => this.options;

    // Set the publish options at runtime (overrides the default publish options).
    withOptions = (extra: PublishOptions): PubsubEvent<T> => {
        this.options = { ...this.options, ...extra };

        return this;
    };
}

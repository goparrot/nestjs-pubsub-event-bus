import { PublishOptions } from './PublishOptions';

export abstract class PubsubEvent<T extends Record<string, any> | Buffer> {
    // Default publish options.
    protected options: PublishOptions = {};
    protected fireLocally: boolean = true;

    constructor(protected data: T) {}

    // Exchange name
    abstract exchange(): string;

    // Provide Event payload (data model).
    payload = (): T => this.data;

    // Get publish options.
    getOptions = (): PublishOptions => this.options;

    // Get local publishing option.
    localEventEnabled = (): boolean => this.fireLocally;

    // Set the publish options at runtime (overrides the default publish options).
    withOptions = (extra: PublishOptions): PubsubEvent<T> => {
        this.options = { ...this.options, ...extra };

        return this;
    };

    withLocalEvent = (allow: boolean = true): PubsubEvent<T> => {
        this.fireLocally = allow;

        return this;
    };
}

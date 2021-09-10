import { PubsubEventListener } from './PubsubEventListener';
import type { PublishOptions } from './PublishOptions';

export abstract class PubsubEvent<T> extends PubsubEventListener<T> {
    // Default publish options.
    protected options: PublishOptions = {};
    protected fireLocally: boolean = false;

    // Exchange name
    abstract exchange(): string;

    // Get publish options.
    getOptions = (): PublishOptions => this.options;

    // Get local publishing option.
    localEventEnabled = (): boolean => this.fireLocally;

    // Set the publish options at runtime (overrides the default publish options).
    withOptions = (extra: PublishOptions): this => {
        this.options = { ...this.options, ...extra };

        return this;
    };

    withLocalEvent = (allow: boolean = true): this => {
        this.fireLocally = allow;

        return this;
    };
}

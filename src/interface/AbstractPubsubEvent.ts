import { AbstractSubscriptionEvent } from './AbstractSubscriptionEvent';
import type { PublishOptions } from './PublishOptions';

export abstract class AbstractPubsubEvent<T extends Record<string, any> | Buffer> extends AbstractSubscriptionEvent<T> {
    // Default publish options
    protected options: PublishOptions = {};
    protected fireLocally: boolean = false;

    // Get publish options.
    getOptions = (): PublishOptions => this.options;

    // Set the publish options at runtime (overrides the default publish options).
    withOptions = (extra: PublishOptions): this => {
        this.options = { ...this.options, ...extra };

        return this;
    };

    // Get local publishing option.
    localEventEnabled = (): boolean => this.fireLocally;

    withLocalEvent = (allow: boolean = true): this => {
        this.fireLocally = allow;

        return this;
    };
}

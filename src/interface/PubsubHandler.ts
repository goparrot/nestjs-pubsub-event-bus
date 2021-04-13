import type { BindingQueueOptions } from './BindingQueueOptions';
import type { PubsubEvent } from './PubsubEvent';

export abstract class PubsubHandler {
    // Exchange name to bind the queue.
    abstract exchange(): string;

    queue = (): string | undefined => undefined;

    // Queue binding options.
    withQueueConfig = (): BindingQueueOptions => ({});

    /**
     * Positively acknowledge event.
     * This method should be used only when automatic acknowledge is disabled.
     * This method should not be overridden
     */
    ack(_event: PubsubEvent<any>): void {}

    /**
     * Negatively acknowledge event.
     * This method should be used only when automatic acknowledge is disabled.
     * This method should not be overridden
     */
    nack(_event: PubsubEvent<any>): void {}
}

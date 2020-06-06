import { BindingQueueOptions } from './BindingQueueOptions';

export abstract class PubsubHandler {
    // Exchange name to bind the queue.
    abstract exchange(): string;

    // Queue binding options.
    withQueueConfig = (): BindingQueueOptions => ({});
}

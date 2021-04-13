export interface IConsumerOptions {
    /**
     * Limit of unacknowledged messages on a consumer
     * @default 10
     */
    prefetchPerConsumer?: number;
    /**
     * Limit of unacknowledged messages on a channel
     */
    prefetchPerChannel?: number;
}

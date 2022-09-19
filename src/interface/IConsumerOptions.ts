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

    /**
     * Amqp queue name prefix. This parameter has the highest priority. When not set application should be started via npm scripts, then package name is used as prefix.
     */
    queueNamePrefix?: string;
}

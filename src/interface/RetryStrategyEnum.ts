export enum RetryStrategyEnum {
    /**
     * Retry mechanism implementation via combination of dead letter exchange and per-message ttl RabbitMQ features
     */
    DEAD_LETTER_TTL = 'DEAD_LETTER_TTL',

    /**
     * Retry mechanism implementation via [RabbitMQ delayed message exchange plugin](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
     * Plugin should be enabled on the RabbitMQ server to use this strategy
     */
    DELAYED_MESSAGE_EXCHANGE = 'DELAYED_MESSAGE_EXCHANGE',
}

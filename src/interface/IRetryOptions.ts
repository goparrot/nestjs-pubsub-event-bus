import type { RetryStrategyEnum } from './RetryStrategyEnum';

export interface IRetryOptions {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetryAttempts?: number;

    /**
     * Delay before each attempt. A fixed value or a function
     * @default Math.floor(1000 * Math.exp(retryCount - 1))
     */
    delay?: number | ((retryCount: number) => number);

    /**
     * Retry strategy to be used
     * @default DEAD_LETTER_TTL
     */
    strategy?: RetryStrategyEnum;
}

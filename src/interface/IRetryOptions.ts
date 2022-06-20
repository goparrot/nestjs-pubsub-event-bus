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
}

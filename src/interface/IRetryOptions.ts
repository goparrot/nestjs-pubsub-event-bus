export interface IRetryOptions {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetryAttempts?: number;

    /**
     * Delay before each attempt. A fixed value or a function
     * @default Math.exp
     */
    delay?: number | ((retryCount: number) => number);
}

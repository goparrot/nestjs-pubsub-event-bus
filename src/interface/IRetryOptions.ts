export interface IRetryOptions {
    /**
     * Maximum number of retry attempts
     */
    maxRetryCount?: number;

    /**
     * Delay before each attempt. A fixed value or a function
     */
    delay?: number | ((retryCount: number) => number);
}

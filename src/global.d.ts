import type { ORIGIN_EXCHANGE_HEADER, RETRY_COUNT_HEADER } from './utils/retry-constants';

module 'amqplib' {
    export interface MessagePropertyHeaders {
        [RETRY_COUNT_HEADER]?: number;
        [ORIGIN_EXCHANGE_HEADER]?: string;
    }
}

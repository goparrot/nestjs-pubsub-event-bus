import snakeCase from 'lodash/snakeCase';
import startCase from 'lodash/startCase';
import type { Message } from 'amqplib';
import last from 'lodash/last';
import type { DelayType } from '../interface';
import { ORIGIN_EXCHANGE_HEADER } from './retry-constants';

/**
 * Transform an event string (event class name) to a RabbitMQ event.
 *
 * @example StoreCreated => "store.created"
 * @example OrderStatusUpdated => "order.status.updated"
 * @example Fanout => "#"
 */
export function toEventName(className: string): string {
    return snakeCase(className.replace(/Event$/, '')).replace(/_/gi, '.');
}

/**
 * Convert event to a producer class name.
 *
 * @example "user.created" => UserCreated
 */
export function toEventClassName(event: string): string {
    return event.split('.').map(startCase).join('');
}

/**
 * Generate queue name based on Event/Handler class name
 *
 * @example StoreNotifierHandler => "store_notifier"
 * @example OrderStatusUpdatedHandler => "order_status_updated";
 */
export function toSnakeCase(className: string | Record<string, unknown>): string {
    if (typeof className === 'object') {
        className = className.constructor.name;
    }

    return snakeCase(className.toString().replace(/Handler$/, ''));
}

export function calculateDelay(delay: DelayType, retryCount: number): number {
    return typeof delay === 'function' ? delay(retryCount) : delay;
}

export function generateQueuePrefixFromPackageName(): string | undefined {
    return last(process.env.npm_package_name?.split('/'))?.replace(/[_-]/gi, '.');
}

export function getMessageExchange(message: Message): string {
    // incorrect typing from @types/amqplib
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return message.properties.headers?.[ORIGIN_EXCHANGE_HEADER] ?? message.fields.exchange;
}

export function appInTestingMode(): boolean {
    return process.env.NODE_ENV === 'test';
}

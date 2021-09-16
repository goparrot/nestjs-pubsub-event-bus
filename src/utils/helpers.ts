import snakeCase from 'lodash/snakeCase';
import startCase from 'lodash/startCase';

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

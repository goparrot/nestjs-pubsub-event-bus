import type { Provider, Type } from '@nestjs/common';
import * as NestCqrs from '@nestjs/cqrs';

export const CQRS_UNHANDLED_EXCEPTION_BUS = 'CQRS_UNHANDLED_EXCEPTION_BUS';

/**
 * The EventBus of @nestjs/cqrs requires its UnhandledExceptionBus since 10.0.0. Earlier versions have neither, so nothing
 * is provided for them
 */
export function createUnhandledExceptionBusProviders(): Provider[] {
    const unhandledExceptionBus = Reflect.get(NestCqrs, 'UnhandledExceptionBus') as Type | undefined;

    return unhandledExceptionBus ? [{ provide: CQRS_UNHANDLED_EXCEPTION_BUS, useExisting: unhandledExceptionBus }] : [];
}

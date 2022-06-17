import type { Provider, Type } from '@nestjs/common';
import type { RetryStrategyEnum } from '../interface';
import type { IRetryStrategy } from '../service';
import { DeadLetterTtlRetryStrategy, DelayedMessageExchangeRetryStrategy } from '../service';

export const CQRS_RETRY_STRATEGIES = 'CQRS_RETRY_STRATEGIES';

export type RetryStrategies = Record<RetryStrategyEnum, IRetryStrategy>;

export function createRetryStrategiesProviders(): Provider[] {
    const strategies: Type<IRetryStrategy>[] = [DeadLetterTtlRetryStrategy, DelayedMessageExchangeRetryStrategy];

    return [
        ...strategies,
        {
            provide: CQRS_RETRY_STRATEGIES,
            useFactory(...strategyInstances: IRetryStrategy[]): RetryStrategies {
                return Object.fromEntries(strategyInstances.map((instance: IRetryStrategy) => [instance.strategy, instance])) as RetryStrategies;
            },
            inject: [...strategies],
        },
    ];
}

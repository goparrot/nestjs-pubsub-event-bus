import type { Provider, Type } from '@nestjs/common';
import type { AutoAckEnum } from '../interface';
import type { AbstractHandleWrapperStrategy } from '../service';
import { AckAndNackStrategy, AlwaysAckStrategy, AutoRetryStrategy, ManualStrategy } from '../service';

export const CQRS_PREPARE_HANDLER_STRATEGIES = 'CQRS_PREPARE_HANDLER_STRATEGIES';

export type PrepareHandlerStrategies = Record<AutoAckEnum, AbstractHandleWrapperStrategy>;

export function createPrepareHandlerStrategiesProviders(): Provider[] {
    const strategies: Type<AbstractHandleWrapperStrategy>[] = [AckAndNackStrategy, AlwaysAckStrategy, AutoRetryStrategy, ManualStrategy];

    return [
        ...strategies,
        {
            provide: CQRS_PREPARE_HANDLER_STRATEGIES,
            useFactory(...strategyInstances: AbstractHandleWrapperStrategy[]): PrepareHandlerStrategies {
                return Object.fromEntries(
                    strategyInstances.map((instance: AbstractHandleWrapperStrategy) => [instance.strategy, instance]),
                ) as PrepareHandlerStrategies;
            },
            inject: [...strategies],
        },
    ];
}

import { Inject, Injectable } from '@nestjs/common';
import type { IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AutoAckEnum, RetryStrategyEnum } from '../../interface';
import { CQRS_RETRY_STRATEGIES, RetryStrategies } from '../../provider';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class AutoRetryStrategy extends AbstractHandleWrapperStrategy {
    readonly strategy = AutoAckEnum.AUTO_RETRY;

    constructor(@Inject(CQRS_RETRY_STRATEGIES) private readonly retryStrategies: RetryStrategies) {
        super();
    }

    process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const { retryOptions } = handlerWrapper.options;

        this.retryStrategies[retryOptions?.strategy ?? RetryStrategyEnum.DEAD_LETTER_TTL].wrapHandler(handlerWrapper, channelWrapper);
    }
}

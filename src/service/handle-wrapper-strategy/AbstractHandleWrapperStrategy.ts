import type { LoggerService } from '@nestjs/common';
import type { AbstractSubscriptionEvent, AutoAckEnum, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AbstractPubsubHandler } from '../../interface';
import { LoggerProvider } from '../../provider';

export abstract class AbstractHandleWrapperStrategy {
    protected get logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected mockAckAndNack(handlerWrapper: IHandlerWrapper): void {
        const { handler } = handlerWrapper;
        const logger = this.logger;

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(AbstractPubsubHandler.prototype, 'ack'),
            value(_event: AbstractSubscriptionEvent<any>): void {
                logger.warn('"ack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(AbstractPubsubHandler.prototype, 'nack'),
            value(_event: AbstractSubscriptionEvent<any>): void {
                logger.warn('"nack" method should not be called with enabled automatic acknowledge', handler.name);
            },
        });
    }

    abstract readonly strategy: AutoAckEnum;

    abstract process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void;
}

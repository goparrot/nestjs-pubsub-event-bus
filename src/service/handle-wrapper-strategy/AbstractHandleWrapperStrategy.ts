import type { LoggerService, Type } from '@nestjs/common';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, AutoAckEnum, IChannelWrapper } from '../../interface';
import { AbstractPubsubHandler } from '../../interface';
import { LoggerProvider } from '../../provider';

export abstract class AbstractHandleWrapperStrategy {
    protected get logger(): LoggerService {
        return LoggerProvider.logger;
    }

    protected mockAckAndNack(handler: Type<AbstractPubsubAnyEventHandler>): void {
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

    abstract process(handler: Type<AbstractPubsubAnyEventHandler>, channelWrapper: IChannelWrapper): void;
}

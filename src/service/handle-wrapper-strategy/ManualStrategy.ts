import { Injectable } from '@nestjs/common';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AutoAckEnum } from '../../interface';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class ManualStrategy extends AbstractHandleWrapperStrategy {
    private implementAckAndNack(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const { handler } = handlerWrapper;

        Reflect.defineProperty(handler.prototype, 'ack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'ack'),
            value(event: AbstractSubscriptionEvent<any>): void {
                const message = event.message();
                if (message) {
                    channelWrapper.ack(message);
                }
            },
        });

        Reflect.defineProperty(handler.prototype, 'nack', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'nack'),
            value(event: AbstractSubscriptionEvent<any>): void {
                const message = event.message();
                if (message) {
                    channelWrapper.nack(message);
                }
            },
        });
    }

    readonly strategy = AutoAckEnum.NEVER;

    process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        this.implementAckAndNack(handlerWrapper, channelWrapper);
    }
}

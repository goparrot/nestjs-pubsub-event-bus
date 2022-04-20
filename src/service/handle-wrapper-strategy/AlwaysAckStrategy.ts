import { Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { AbstractSubscriptionEvent, IChannelWrapper, IHandlerWrapper } from '../../interface';
import { AutoAckEnum } from '../../interface';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class AlwaysAckStrategy extends AbstractHandleWrapperStrategy {
    private addAlwaysPositiveAck(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        const { handler } = handlerWrapper;
        const originalMethod: IEventHandler['handle'] = handler.prototype.handle;

        Reflect.defineProperty(handler.prototype, 'handle', {
            ...Reflect.getOwnPropertyDescriptor(handler.prototype, 'handle'),
            async value(event: AbstractSubscriptionEvent<any>): Promise<void> {
                try {
                    await originalMethod.apply(this, [event]);
                } finally {
                    const message = event.message();
                    if (message) {
                        channelWrapper.ack(message);
                    }
                }
            },
        });
    }

    readonly strategy = AutoAckEnum.ALWAYS_ACK;

    process(handlerWrapper: IHandlerWrapper, channelWrapper: IChannelWrapper): void {
        this.mockAckAndNack(handlerWrapper);
        this.addAlwaysPositiveAck(handlerWrapper, channelWrapper);
    }
}

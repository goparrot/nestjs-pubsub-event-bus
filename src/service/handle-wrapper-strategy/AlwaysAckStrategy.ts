import type { Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { IEventHandler } from '@nestjs/cqrs';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, IChannelWrapper } from '../../interface';
import { AutoAckEnum } from '../../interface';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class AlwaysAckStrategy extends AbstractHandleWrapperStrategy {
    private addAlwaysPositiveAck(handler: Type<AbstractPubsubAnyEventHandler>, channelWrapper: IChannelWrapper): void {
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

    process(handler: Type<AbstractPubsubAnyEventHandler>, channelWrapper: IChannelWrapper): void {
        this.mockAckAndNack(handler);
        this.addAlwaysPositiveAck(handler, channelWrapper);
    }
}

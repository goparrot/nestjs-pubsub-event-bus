import type { Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { AbstractPubsubAnyEventHandler, AbstractSubscriptionEvent, IChannelWrapper } from '../../interface';
import { AutoAckEnum } from '../../interface';
import { AbstractHandleWrapperStrategy } from './AbstractHandleWrapperStrategy';

@Injectable()
export class ManualStrategy extends AbstractHandleWrapperStrategy {
    private implementAckAndNack(handler: Type<AbstractPubsubAnyEventHandler>, channelWrapper: IChannelWrapper): void {
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

    process(handler: Type<AbstractPubsubAnyEventHandler>, channelWrapper: IChannelWrapper): void {
        this.implementAckAndNack(handler, channelWrapper);
    }
}

import 'reflect-metadata';
import { IEvent } from '@nestjs/cqrs';
import { PUBSUB_EVENT_HANDLER_METADATA } from './constant';

export const PubsubEventHandler = (...events: IEvent[]): ClassDecorator => {
    return (target: Record<string, any>): void => {
        Reflect.defineMetadata(PUBSUB_EVENT_HANDLER_METADATA, events, target);
    };
};

import { PUBSUB_EVENT_NAME } from './constant';

export function PubsubEventName(name: string): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (target: object): void => {
        Reflect.defineMetadata(PUBSUB_EVENT_NAME, name, target);
    };
}

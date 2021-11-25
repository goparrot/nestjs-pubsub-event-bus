# PubsubEventBus

PubsubEventBus is built on top of [NestJS CQRS module](https://github.com/nestjs/cqrs).

It gives the ability to use NestJS Cqrs Module across microservice architecture, using RabbitMQ message broker.

## Installation

First install the required package:

`npm install --save @goparrot/pubsub-event-bus`

It is highly recommended installing `peerDependencies` by yourself.

## Import module

Import module & configure it by providing the connection string.

```ts
import { CqrsModule } from '@goparrot/pubsub-event-bus';

export const connections: string[] = ['amqp://username:pass@example.com/virtualhost'];

@Module({
    imports: [CqrsModule.forRoot({ connections })],
})
export class AppModule {}
```

Note: The `CqrsModule` class should be imported from `@goparrot/pubsub-event-bus` library.

## Events

### Create event

Event is a simple class with message payload.

```ts
export class StoreCreated implements IEvent {
    constructor(private readonly storeId: string) {}
}
```

This is the fully compatible event class that can be used with NestJS EventBus.

In order to make it PubSub ready, it should extend the `AbstractPubsubEvent` class and be decorated with `PubsubEvent` (both imported
from `@goparrot/pubsub-event-bus`).

```ts
import { AbstractPubsubEvent, PubsubEvent } from '@goparrot/pubsub-event-bus';

export interface IStoreCreatedPayload {
    storeId: string;
}

@PubsubEvent({ exchange: 'store' })
export class StoreCreated extends AbstractPubsubEvent<IStoreCreatedPayload> {}
```

### Publish event

Inject `EventBus` into the service in order to emit the event (imported from `@goparrot/pubsub-event-bus`).

```ts
import { EventBus } from '@goparrot/pubsub-event-bus';
import { Injectable } from '@nestjs/common';

@Injectable()
class SomeService {
    constructor(private readonly eventBus: EventBus) {}

    async doCoolStuff() {
        // create item

        await this.eventBus.publish(new StoreCreated({ storeId }));

        // return item
    }
}
```

## Consuming events

### Create event handler

Create a simple class which extends `AbstractPubsubHandler` and is decorated with `PubsubEventHandler` (both imported from `@goparrot/pubsub-event-bus`).

```ts
import { AbstractPubsubHandler, PubsubEventHandler } from '@goparrot/pubsub-event-bus';

@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends AbstractPubsubHandler<StoreCreated> {
    handle(event: StoreCreated) {
        console.log(`[${this.constructor.name}] ->`, event.payload);
    }
}
```

Notice, Unlike regular Cqrs events handlers, PubSub EventHandler uses its own decorator `@PubsubEventHandler(StoreCreated)`

`@PubsubEventHandler` decorator accepts a list of Events it is listening for, like:

```ts
@PubsubEventHandler(StoreCreated, UserCreated)
```

### Implement required methods:

`handle` - central point where event payload will come

### Register event handler

Register the event handler as a module provider:

```ts
@Module({
    providers: [StoreCreatedHandler],
})
export class AppModule {}
```

Once registered, event handler will start listening for incoming events.

## Configuration

In order to emit an event with extra headers, just call the `withOptions({})` method and provide required configuration:

```ts
await this.eventBus.publish(
    new StoreCreated({ storeId: 'storeId' }).withOptions({
        persistent: false,
        priority: 100,
        headers: ['...'],
    }),
);
```

The same goes for Event Handlers, queue configuration can be defined using `withQueueConfig` method.

```ts
import { AbstractPubsubHandler, PubsubEventHandler } from '@goparrot/pubsub-event-bus';

@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends AbstractPubsubHandler<StoreCreated> {
    withQueueConfig = (): Options.AssertQueue => ({
        exclusive: true,
        durable: false,
        messageTtl: 10,
    });
}
```

## Enjoy!

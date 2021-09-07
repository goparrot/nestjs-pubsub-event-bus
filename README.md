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
export class StoreCreated {
    constructor({ storeId: 'real-store-id' }) {}
}
```

This is the fully compatible event class that can be used with NestJS EventBus.

In order to make it a PubSub ready, it should extend a `PubsubEvent` class (imported from `@goparrot/pubsub-event-bus`).

Once extended, implement methods required by `PubsubEvent`:

`exchange` - the RabbitMQ exchange name (there is a list of predefined valid exchanges)

So, assuming, the payload data model is:

```ts
export interface IStoreCreatedPayload {
    storeId: string;
}
```

We're going to create a new event class:

```ts
export class StoreCreated extends PubsubEvent<IStoreCreatedPayload> {
    exchange = (): string => 'store';
}
```

### Publish event

Inject `EventBus` into your service/controller in order to emit the event.

```ts
class SomeService {
    constructor(private readonly eventBus: EventBus) {}

    async doCoolStuff() {
        // create item

        await this.eventBus.publish(new ItemCreated({ storeId }));

        // return item
    }
}
```

## Consuming events

### Create event handler

Create a simple class which extends `PubsubHandler` and implements `IEventHandler` interface
`PubsubHandler` - comes from `@goparrot/pubsub-event-bus`
`IEventHandler` - comes from `@nestjs/cqrs`

```ts
@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends PubsubHandler implements IEventHandler {
    handle(event: StoreCreated) {
        console.log(`[${this.constructor.name}] ->`, event.payload());
    }

    exchange = (): string => 'store';
}
```

Notice, Unlike regular Cqrs events handlers, PubSub EventHandler uses its own decorator `@PubsubEventHandler(StoreCreated)`

`@PubsubEventHandler` decorator accepts a list of Events it is listening for, like:

```ts
@PubsubEventHandler(StoreCreated, UserCreated)
```

or it may be listening for all events in desired exchange ('#' - fanout), just add a `Fanout` event:

```ts
@PubsubEventHandler(Fanout)
```

[Note] EventBus pushes the message through the NestJS EventBus and through the RabbitMQ. That means that this handler is still perfectly compatible with NestJS
event handler, so it can be used by the same service which produces the event.

MicroService 1 -> Produces Event MicroService 2 <- Consumes Event MicroService 3 <- Consumes Event MicroService 1 <- Consumes Event (just use
default `@EventHandler` decorator and there is no need to extend `PubsubHandler` class)!

### Implement required methods:

`handle` - central point where event payload will come

`exchange` - exchange, consumer will be bound its queue to.

### Register event handler

Register event handler you've just created as a module provider:

```ts
@Module({
    ...,
    providers: [StoreCreatedHandler],
})
export class AppModule {}
```

Once registered, event handler will start listening for incoming events.

## Configuration

In order to emit an event with extra headers, just call the `withOptions({})` method and provide required configuration:

```ts
this.eventBus.publish(
    new StoreCreated('storeId').withOptions({
        persistent: false,
        priority: 100,
        headers: ['...'],
    }),
);
```

The same goes for Event Handlers, you can define a method `withQueueConfig` in order to define queue configuration.

Also, you can define a very specific events, it will be listening for, by declaring the `listenFor` method.

```ts
@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends PubsubHandler implements IEventHandler<StoreCreated> {
    withQueueConfig = (): Options.AssertQueue => ({
        exclusive: true,
        durable: false,
        messageTtl: 10,
    });
}
```

## Enjoy!

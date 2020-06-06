# RabbitMQ CQRS module

RabbitMQ CQRS Module built on top of NestJS CQRS.
It gives the ability to use NestJS CqrsModule across microservice architecture, using RabbitMQ message broker.

## Installation

First install the required package:

`npm install --save @goparrot/pubsub-event-bus`

Optionally, install `peerDependencies`, recommended by a package.

## Import module

Import module & configure it by providing the connection string.

    @Module({
        imports: [
            CqrsModule.forRoot({
                connections: ['amqp://username:pass@example.com/virtualhost'],
            }),
        ],
    })
    export class AppModule {}

Note: `CqrsModule` is imported from `@goparrot/pubsub-event-bus` library.

## Publish event

Inject `EventBus` into your service/controller in order to emit events.

```ts
this.eventBus.publish(new StoreCreated({ storeId }));
```

### Create & publish events

Event is a simple class, that handles the event payload.

```ts
export class ItemCreated {
    constructor(readonly itemId: string) {}
}
```

In order to make it a PubSub ready, it should extend a `PubsubEvent` class (from `@goparrot/pubsub-event-bus`).

Once extended, implement methods required by `PubsubEvent`:

`exchange` - the RabbitMQ exchange name (there is a list of predefined valid exchanges)

Example of predefined event:

```ts
export class StoreCreated extends PubsubEvent<IStoreCreatedPayload> {
    constructor(readonly data: IStoreCreatedPayload) {
        super();
    }

    exchange = (): PubsubPlatformExchangeEnum => PubsubPlatformExchangeEnum.PLATFORM_STORE_V2;
}
```

## Listen for events

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

    exchange(): PubsubPlatformExchangeEnum {
        return PubsubPlatformExchangeEnum.PLATFORM_STORE_V2;
    }
}
```

Notice, Unlike regular Cqrs events handlers, PubSub EventHandler uses its own decorator `@PubsubEventHandler(StoreCreated)`

`@PubsubEventHandler` decorator accepts a list of Events it is listening for, like:

```ts
@PubsubEventHandler(StoreCreated, UserCreated)
```

or it may be listening for all events in desired exchange ("#" - fanout), just add a `Fanout` event:

```ts
@PubsubEventHandler(Fanout)
```

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
export class StoreCreatedHandler extends Consumer implements IEventHandler {
    withQueueConfig = (): Options.AssertQueue => ({
        exclusive: true,
        durable: false,
        messageTtl: 10,
    });
}
```

### TODO
1. test it in production, before releasing in public (releasing raw solution is not a good way)
2. add more documentation about configuration (library, module, producer, consumer).
3. add unit tests
4. prepare public release: configure github pipeline, add contribution policy, bug reports, license, etc...
5. perform public release: write Medium article, social share, etc...

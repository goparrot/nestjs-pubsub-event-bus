## Migration guide

This article provides a set of guidelines for migrating from `@goparrot/pubsub-event-bus version` 1.5.2 to version 2.0.0

### PubSub Event

- Replace `extends PubsubEvent` with `extends AbstractPubsubEvent` and remove `implements IEvent`
- Add `@PubsubEvent` decorator to the event class with the exchange name
- Remove the `exchange` method from the event class

Before:

```typescript
export class MyPubsubEvent extends PubsubEvent<IMyPubsubEvent> {
    exchange: () => "my_exchange";
}
```

Now:

```typescript
@PubsubEvent({ exchange: "my_exchange" })
export class MyPubsubEvent extends AbstractPubsubEvent<IMyPubsubEvent> {}
```

### PubSub Event Listener

- Replace `extends PubsubEventListener` with `extends AbstractSubscriptionEvent` and remove `implements IEvent`
- Add `@SubscriptionEvent` decorator to the event class with the exchange name
- Remove the `exchange` method from the event class

Before:

```typescript
export class MyPubsubEvent extends PubsubEventListener<IMyPubsubEvent> {
    exchange: () => "my_exchange";
}
```

Now:

```typescript
@SubscriptionEvent({ exchange: "my_exchange" })
export class MyPubsubEvent extends AbstractSubscriptionEvent<IMyPubsubEvent> {}
```

### PubsubEventName Decorator

`PubsubEventName` decorator has been removed. Use `PubsubEvent` and `SubscriptionEvent` decorators `customRoutingKey` and `customBindingPattern`

```typescript
@PubsubEventName("another.pubsub")
export class MyPubsubEvent extends PubsubEvent<IMyPubsubEvent> {
    exchange: () => "my_exchange";
}
```

Now:

```typescript
@PubsubEvent({ exchange: "my_exchange", customBindingPattern: "another.pubsub" })
export class MyPubsubEvent extends AbstractPubsubEvent<IMyPubsubEvent> {}
```

### PubsubFanoutEvent decorator

`PubsubFanoutEvent` decorator options interface has been changed

```typescript
@PubsubFanoutEvent()
export class MyPubsubEvent extends PubsubEvent<IMyPubsubEvent> {
    exchange: () => "my_exchange";
}
```

Now:

```typescript
@PubsubFanoutEvent({ exchange: "my_exchange" })
export class MyPubsubEvent extends AbstractPubsubEvent<IMyPubsubEvent> {}
```

### Pubsub Event Handler

- Replace `extends PubsubHandler` with `extends AbstractPubsubHandler<Event>` and remove `implements IEventHandler<Event>`
- Event payload is now a readonly field instead of the class method. It should not be invoked
- Remove the `exchange` method from the event handler class

Before:

```typescript
export class MyPubsubEventHandler extends PubsubHandler implements IEventHandler<MyPubsubEvent> {
    exchange: () => "my_exchange";

    async handle(event: MyPubsubEvent): Promise<void> {
        const payload: IMyPubsubEvent = event.payload();
    }
}
```

Now:

```typescript
export class MyPubsubEventHandler extends AbstractPubsubHandler<MyPubsubEvent> {
    async handle(event: MyPubsubEvent): Promise<void> {
        const payload: IMyPubsubEvent = event.payload;
    }
}
```

### Event Bus

- Add `await` before all `eventBus.publish` and `eventBus.publishAll`

### RabbitMQ Queue

Queue name generation algorithm has been changed. Before the code deployment it is required to check that the old queues are empty not to lose the messages in
it. After the code is deployed it is required to manually delete old queues.

- Old Queue Name Format: `exchange:application_name:handler_name`
- New Queue Name Format: `application_name:handler_name`

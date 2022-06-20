# PubSub Event Bus

[![npm version](https://badge.fury.io/js/@goparrot%2Fpubsub-event-bus.svg)](https://badge.fury.io/js/@goparrot%2Fpubsub-event-bus)
![Build Status](https://github.com/goparrot/nestjs-pubsub-event-bus/workflows/CI/badge.svg)

PubSub Event Bus is built on top of [NestJS CQRS module](https://github.com/nestjs/cqrs).

It gives the ability to use NestJS Cqrs Module across microservice architecture, using RabbitMQ message broker.

## Installation

First install the required package:

```shell
npm install --save @goparrot/pubsub-event-bus
```

It is highly recommended installing `peerDependencies` by yourself.

## Import module

Import module & configure it by providing the connection string.

```ts
import { CqrsModule } from "@goparrot/pubsub-event-bus";

export const connections: string[] = ["amqp://username:pass@example.com/virtualhost"];

@Module({
  imports: [CqrsModule.forRoot({ connections })],
})
export class AppModule {}
```

Full list of the PubSub CQRS Module options:

| Options        | Description                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| connections    | Array of connection strings                                                                                                                                               |
| config         | AMQP connection options                                                                                                                                                   |
| isGlobal       | Should the module be registered as global                                                                                                                                 |
| logger         | Logger service to be used                                                                                                                                                 |
| connectionName | Name of the connection to be displayed in the server logs and management UI. Final name will have a suffix `:producer` or `:consumer` depending on the connection purpose |
| retryOptions   | Global options for the retry mechanism. Read more in the [Retry Mechanism section](#retry-mechanism)                                                                      |

Note: The `CqrsModule` class should be imported from `@goparrot/pubsub-event-bus` library.

## Usage

### Create event

Event is a simple class with message payload.

```ts
export class StoreCreated implements IEvent {
  constructor(private readonly storeId: string) {}
}
```

This is a fully compatible event class that can be used with NestJS EventBus.

In order to make it PubSub ready, it should extend the `AbstractPubsubEvent` class and be decorated with `PubsubEvent` (
both imported from `@goparrot/pubsub-event-bus`).

```ts
import { AbstractPubsubEvent, PubsubEvent } from "@goparrot/pubsub-event-bus";

export interface IStoreCreatedPayload {
  storeId: string;
}

@PubsubEvent({ exchange: "store" })
export class StoreCreated extends AbstractPubsubEvent<IStoreCreatedPayload> {}
```

### Publish event

Inject `EventBus` into the service in order to emit the event (imported from `@goparrot/pubsub-event-bus`).

```ts
import { EventBus } from "@goparrot/pubsub-event-bus";
import { Injectable } from "@nestjs/common";

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

### Consuming events

#### Create event handler

Create a simple class which extends `AbstractPubsubHandler` and is decorated with `PubsubEventHandler` (both imported
from `@goparrot/pubsub-event-bus`).

```ts
import { AbstractPubsubHandler, PubsubEventHandler } from "@goparrot/pubsub-event-bus";

@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends AbstractPubsubHandler<StoreCreated> {
  handle(event: StoreCreated) {
    console.log(`[${this.constructor.name}] ->`, event.payload);
  }
}
```

Notice, Unlike regular Cqrs events handlers, PubSub EventHandler uses its own
decorator `@PubsubEventHandler(StoreCreated)`

`@PubsubEventHandler` decorator accepts a list of Events it is listening for, like:

```ts
@PubsubEventHandler(StoreCreated, UserCreated)
```

#### Implement required methods:

`handle` - central point where event payload will come

#### Register event handler

Register the event handler as provider:

```ts
@Module({
  providers: [StoreCreatedHandler],
})
export class AppModule {}
```

Once registered, event handler will start listening for incoming events.

## Configuration

### Event Configuration

In order to emit an event with extra headers, just call the `withOptions({})` method and provide required configuration:

```ts
await this.eventBus.publish(
  new StoreCreated({ storeId: "storeId" }).withOptions({
    persistent: false,
    priority: 100,
    headers: ["..."],
  }),
);
```

### Handler Configuration

`PubsubEventHandler` decorator accepts handler options as the last argument. List of available options

| Options             | Description                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| autoAck             | Event acknowledge mode. Default `ALWAYS_ACK`. Read more in the [Acknowledge Mode section](#acknowledge-mode) |
| queue               | Custom queue name                                                                                            |
| bindingQueueOptions | Queue binding options from the `amqplib`                                                                     |
| retryOptions        | Handler specific retry options. Read more in the [Retry Mechanism section](#retry-mechanism)                 |

#### Acknowledge Mode

By default, library creates queues without automatic delivery acknowledgement, therefore, messages should be
acknowledged by the client. There are several acknowledge modes provided by the library:

##### `ALWAYS_ACK` (default)

Positive acknowledge in case of success or failure

##### `ACK_AND_NACK`

Automatic positive ack in case of success and automatic negative acknowledge in case of error

##### `NEVER`

Acknowledge should be performed manually. Message can be manually positively or negatively acknowledged
using `AbstractPubsubHandler.ack` and `AbstractPubsubHandler.nack` methods respectively

##### `AUTO_RETRY`

Automatic positive ack in case of success and automatic retry attempt in case of error. Read more in
the [Retry Mechanism section](#retry-mechanism)

## Retry Mechanism

PubSub Event Bus supports automatic event processing retries with static or dynamic backoff. It can be enabled by
setting acknowledge mode to `AUTO_RETRY`. In case of any unhandled error library will publish the event to the delayed
exchange to return it back the queue with a delay.

Retry mechanism can be configured both on module and handler levels. Handler specific options are merged with the module
ones.

Available options:

| Options          | Description                                                                                                                                            | Default value                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| maxRetryAttempts | Maximum number of retry attempts                                                                                                                       | 3                                             |
| delay            | Delay between retry attempts in milliseconds. Can be a fixed positive number or a function that receives current retry attempt count and returns delay | `Math.floor(1000 * Math.exp(retryCount - 1))` |
| strategy         | Retry strategy to be used. Read more in the [Retry Strategies section](#retry-strategies)                                                              | `DEAD_LETTER_TTL`                             |

When number of retry attempts is exceeded handler method `onRetryAttemptsExceeded` is called with the event and last
error as arguments. Then message is discarded.

Example:

```ts
// app.module.ts

import { CqrsModule, RetryStrategyEnum } from "@goparrot/pubsub-event-bus";

export const connections: string[] = ["amqp://username:pass@example.com/virtualhost"];

@Module({
  imports: [
    CqrsModule.forRoot({
      connections,
      retryOptions: {
        maxRetryAttempts: 5,
        delay: (retryCount: number) => retryCount * 1000,
        strategy: RetryStrategyEnum.DELAYED_MESSAGE_EXCHANGE,
      },
    }),
  ],
})
export class AppModule {}

// store-created.handler.ts

import { AbstractPubsubHandler, PubsubEventHandler, RetryStrategyEnum } from "@goparrot/pubsub-event-bus";

@PubsubEventHandler(StoreCreated, {
  autoAck: AutoAckEnum.AUTO_RETRY,
  retryOptions: {
    maxRetryAttempts: 10,
    delay: (retryCount: number) => retryCount ** 2 * 1000,
    strategy: RetryStrategyEnum.DEAD_LETTER_TTL,
  },
})
export class StoreCreatedHandler extends AbstractPubsubHandler<StoreCreated> {
  async handle(event: StoreCreated) {
    // process the event
  }

  async onRetryAttemptsExceeded(event: StoreCreated, error: Error) {
    // log the event processing failure
  }
}
```

### Retry Strategies

This library provides two different strategies for retry mechanism implementation. The main differences are requirements
and performance.

#### Dead Letter Message and Per-Message TTL Strategy

This strategy has no additional requirements and therefore is the default one.

Library creates several RabbitMQ components:

- Waiting queues, one for each waiting time
- Exchange to route messages to the corresponding waiting queue
- Exchange to route messages back to source queue

Example:

There are two PubSub handlers:  
The first one with static delay 1000 ms and 5 maximum retry attempts. Only one queue is required with waiting time 1000
ms.  
The second one with delay function `1000*2^x` ms and 3 maximum retry attempts. Several queues are required with waiting
time 1000, 2000 and 4000 ms.

Therefore, library will create 3 queues with 1000, 2000 and 4000 ms waiting time. Queue with waiting time 1000 ms will
be used for both handlers.

#### Delayed Message Exchange Strategy

This strategy requires [RabbitMQ Delayed Message Plugin](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
to be installed and enabled on the RabbitMQ server.

Library creates a delayed message exchange to route messages back to the source queue with a set delay.

## Enjoy!

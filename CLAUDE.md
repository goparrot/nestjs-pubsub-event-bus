# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@goparrot/pubsub-event-bus` - a NestJS CQRS extension that adds RabbitMQ-based pub/sub capabilities to the standard NestJS CQRS module. It allows event-driven communication across microservices using RabbitMQ as the message broker.

**Key Capabilities:**

- Event publishing to RabbitMQ exchanges
- Event consumption with automatic message handling
- Retry mechanism with two strategies (Dead Letter TTL and Delayed Message Exchange)
- Multiple acknowledge modes for message handling
- Support for NestJS 10 and 11
- Support for RabbitMQ 3.13.x and 4.x (dual compatibility)

## Development Commands

### Building

```bash
npm run build:dist              # Build all output formats (CJS, ESM, types)
npm run build:dist:cjs          # Build CommonJS output
npm run build:dist:esm          # Build ESM output
npm run build:dist:types        # Build type declarations
```

### Testing

```bash
npm test                        # Run all tests
npm run coverage                # Run tests with coverage
npm run test:docker:up          # Start RabbitMQ 3.13.3 (default)
npm run test:docker:up:4        # Start RabbitMQ 4.1.0
npm run test:docker:down        # Stop RabbitMQ container
```

### Linting & Formatting

```bash
npm run lint                    # Check code style
npm run format                  # Fix formatting issues
npm run typecheck               # Run TypeScript type checking
npm run format:staged           # Format staged files (used by pre-commit)
```

### Publishing

```bash
npm run publish:dev             # Publish dev version with prerelease tag
npm run publish:dev:dry         # Dry run of dev publish (safe to run)
npm run pre-commit              # Run all checks (format, typecheck, lint, coverage)
```

## Architecture

### Core Components

**CqrsModule** (`src/CqrsModule.ts`)

- Main module that bootstraps the entire system
- Wraps NestJS CQRS module and adds pub/sub capabilities
- Use `CqrsModule.forRoot()` or `CqrsModule.forRootAsync()` to register
- On bootstrap, discovers handlers, registers them, and binds pub/sub events

**EventBus** (`src/service/EventBus.ts`)

- Extends NestJS EventBus with pub/sub publishing
- Uses custom `Publisher` that routes events to both local handlers and RabbitMQ

**Producer** (`src/service/Producer.ts`)

- Publishes events to RabbitMQ exchanges
- Manages exchange assertions and routing keys
- Handles publish options and headers

**Consumer** (`src/service/Consumer.ts`)

- Listens to RabbitMQ queues for incoming events
- Manages queue bindings to exchanges
- Configures acknowledge modes via handle wrapper strategies
- Supports retry infrastructure setup

**PubSubEventBinder** (`src/service/PubSubEventBinder.ts`)

- Discovers and registers pub/sub event handlers at runtime
- Binds handlers to queues and routes messages to the correct event classes
- Handles message routing pattern matching (exact match and wildcard patterns)

### Event Flow

1. **Publishing**: `EventBus.publish()` → `Publisher` → `Producer.produce()` → RabbitMQ
2. **Consuming**: RabbitMQ → `Consumer.consume()` → `PubSubEventBinder.emitPubSubEvent()` → `EventBus.publisher.publishLocally()` → Handler

### Key Abstractions

**AbstractPubsubEvent** (`src/interface/AbstractPubsubEvent.ts`)

- Base class for all pub/sub events
- Provides `withOptions()` for runtime publish configuration
- Provides `withLocalEvent()` to control local event firing

**AbstractPubsubHandler** (`src/interface/AbstractPubsubHandler.ts`)

- Base class for all pub/sub event handlers
- Requires `handle()` method implementation
- Optional `onRetryAttemptsExceeded()` for retry exhaustion handling
- Provides `ack()` and `nack()` for manual acknowledgement

### Decorators

**@PubsubEvent** (`src/decorator/PubsubEvent.ts`)

- Decorates event classes to specify exchange and routing configuration
- Required on all events that need pub/sub capabilities

**@PubsubEventHandler** (`src/decorator/PubsubEventHandler.ts`)

- Decorates handler classes to specify which events they handle
- Accepts handler options (autoAck mode, queue name, retry options)

### Retry Strategies

Two strategies are available via `RetryStrategyEnum`:

**DEAD_LETTER_TTL** (`src/service/retry-strategy/DeadLetterTtlRetryStrategy.ts`)

- Default strategy, no RabbitMQ plugins required
- Creates waiting queues with TTL for each unique delay duration
- Uses dead letter exchange to route messages back to source queue

**DELAYED_MESSAGE_EXCHANGE** (`src/service/retry-strategy/DelayedMessageExchangeRetryStrategy.ts`)

- Requires RabbitMQ Delayed Message Plugin
- Uses delayed message exchange for simpler infrastructure
- More efficient but requires plugin installation

### Handle Wrapper Strategies

Located in `src/service/handle-wrapper-strategy/`, these implement different acknowledge modes:

- **AlwaysAckStrategy**: Always acknowledges (default)
- **AckAndNackStrategy**: Ack on success, nack on failure
- **ManualStrategy**: Requires manual ack/nack in handler
- **AutoRetryStrategy**: Automatic retry with configurable backoff

## Important Implementation Notes

### Queue Naming Convention

Queue names are automatically generated as `{platform}:{handler_name}` where:

- `platform` is derived from `npm_package_name` environment variable
- `handler_name` is the snake_case version of the handler class name

Example: `my.app:store_created_handler`

### Testing Mode Detection

The library detects testing mode via `appInTestingMode()` utility. When in test mode:

- Producer doesn't publish to RabbitMQ
- Consumer doesn't consume from RabbitMQ
- No actual connections are established

This allows unit testing without RabbitMQ infrastructure.

### Event Handler Discovery

`ExplorerService` (`src/service/ExplorerService.ts`) discovers handlers at runtime by:

1. Scanning all providers in the module
2. Filtering for handlers decorated with `@PubsubEventHandler`
3. Extracting metadata to determine which events each handler listens to

### Message Routing Pattern Matching

When a message arrives, `PubSubEventBinder` matches it to handler event classes via:

1. First tries exact match: `toEventName(event.name) === message.properties.type`
2. Falls back to wildcard pattern matching using binding patterns
3. Supports `*` wildcards in binding patterns (e.g., `store.*` matches `store.created`, `store.updated`)

## TypeScript Configuration

- Target: ES2021
- Module: CommonJS (with ESM build option)
- Decorators: Enabled (`experimentalDecorators`, `emitDecoratorMetadata`)
- Strict mode enabled with some exceptions:
  - `strictPropertyInitialization: false`
  - `noImplicitAny: false`

## Peer Dependencies

This library requires consumers to install:

- `@nestjs/common` (^10.0.0 || ^11.0.0)
- `@nestjs/core` (^10.0.0 || ^11.0.0)
- `@nestjs/cqrs` (^10.0.0 || ^11.0.0)
- `amqp-connection-manager` (^4.0.0)
- `amqplib` (>=0.10.7) - **Version 7.0.0+ requires 0.10.7+** for RabbitMQ 4 compatibility
- `reflect-metadata` (>=0.1.13)

## RabbitMQ Compatibility

### Supported Versions

This library supports **BOTH** RabbitMQ 3.13.x and 4.x versions:

| RabbitMQ Version | Status             | Notes                      |
| ---------------- | ------------------ | -------------------------- |
| 3.13.x           | ✅ Fully Supported | Classic queues default     |
| 4.0.x            | ✅ Fully Supported | Quorum queues default      |
| 4.1.0+           | ✅ Fully Supported | Requires amqplib >= 0.10.7 |

### Key Differences Between Versions

**RabbitMQ 3.13:**

- Classic queues are default
- frame_max minimum: 4096 bytes
- Classic queue mirroring available

**RabbitMQ 4.0+:**

- Quorum queues are default (library explicitly configures classic queues)
- frame_max minimum: 8192 bytes (4.1.0+)
- Classic queue mirroring removed
- AMQP 1.0 enabled by default

### Library Implementation

The library **explicitly configures queue types**, so the default queue type change in RabbitMQ 4 does not affect behavior. Both versions work identically from the library's perspective.

### CI/CD Testing

The CI/CD pipeline tests against **both** RabbitMQ 3.13 and 4.1 in a matrix configuration:

- 3 Node.js versions (18, 20, 22)
- 2 NestJS versions (10, 11)
- 2 RabbitMQ versions (3.13.3, 4.1.0)
- Total: 12 test combinations per build

This ensures dual compatibility is maintained.

## Common Patterns

### Creating a New Event

```typescript
import { AbstractPubsubEvent, PubsubEvent } from "@goparrot/pubsub-event-bus";

export interface IStoreCreatedPayload {
  storeId: string;
}

@PubsubEvent({ exchange: "store" })
export class StoreCreated extends AbstractPubsubEvent<IStoreCreatedPayload> {}
```

### Creating an Event Handler

```typescript
import { AbstractPubsubHandler, PubsubEventHandler } from "@goparrot/pubsub-event-bus";

@PubsubEventHandler(StoreCreated)
export class StoreCreatedHandler extends AbstractPubsubHandler<StoreCreated> {
  async handle(event: StoreCreated): Promise<void> {
    console.log(`Store created: ${event.payload.storeId}`);
  }
}
```

### Publishing an Event

```typescript
import { EventBus } from "@goparrot/pubsub-event-bus";
import { Injectable } from "@nestjs/common";

@Injectable()
class SomeService {
  constructor(private readonly eventBus: EventBus) {}

  async createStore(storeId: string) {
    await this.eventBus.publish(new StoreCreated({ storeId }));
  }
}
```

## Known Limitations

**Multiple handlers for the same event**: When multiple handlers listen to the same event, each receives duplicates equal to the number of listeners. Workaround is to create a "proxy" handler that either:

1. Publishes a local event for multiple local handlers
2. Executes multiple commands within the proxy handler

This is documented in README.md under "Known Issues".

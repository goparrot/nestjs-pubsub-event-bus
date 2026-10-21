# Changelog

# [7.0.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v5.0.0...v7.0.0) (2024-12-24)

### Features

- **rabbitmq:** add RabbitMQ 4.x support with dual 3.13/4.x compatibility
- **ci:** add RabbitMQ version matrix testing (3.13.3 and 4.1.0)
- **docker:** add RABBITMQ_VERSION environment variable support for testing

### BREAKING CHANGES

- **deps:** minimum `amqplib` version increased from `>=0.5` to `>=0.10.7`
  - Required for RabbitMQ 4.1.0+ compatibility (frame_max requirement)
  - Consumers must upgrade `amqplib` to `>=0.10.7` before upgrading this library

### Migration Guide

**Before upgrading to v7.0.0:**

```bash
# 1. Check current amqplib version
npm list amqplib

# 2. Upgrade amqplib to 0.10.7 or later
npm install amqplib@^0.10.9

# 3. Then upgrade the library
npm install @goparrot/pubsub-event-bus@^7.0.0
```

**No code changes required!** The library API remains unchanged and works identically with both RabbitMQ 3.13.x and 4.x.

### Technical Details

- RabbitMQ 4.1.0 increased minimum `frame_max` from 4096 to 8192 bytes
- amqplib 0.10.7+ defaults to `frame_max=131072` for compatibility
- Library maintains backward compatibility with RabbitMQ 3.13.x
- CI/CD now tests 12 combinations: 3 Node versions × 2 NestJS versions × 2 RabbitMQ versions

# [6.0.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v5.0.0...v6.0.0) (2025-12-24)

### Bug Fixes

- **eventbus:** add explicit @Inject decorator for Producer to fix NestJS 11 dependency injection ([2246eca](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/2246eca))
- **tests:** add runtime checks to skip NestJS 10-specific tests when running with NestJS 11 ([2246eca](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/2246eca))

### Features

- support NestJS 11 alongside NestJS 10 ([2246eca](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/2246eca))
- add CI matrix testing for both NestJS 10 and 11 with Node.js 18/20/22 ([2246eca](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/2246eca))

### BREAKING CHANGES

- Node.js 18+ is now required (dropped Node.js 16 support)
- Peer dependencies updated to support both NestJS 10 and 11: `@nestjs/common@^10.0.0 || ^11.0.0`, `@nestjs/core@^10.0.0 || ^11.0.0`, `@nestjs/cqrs@^10.0.0 || ^11.0.0`

# [5.0.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.1.2...v5.0.0) (2024-01-24)

### Bug Fixes

- minimal node version >=16 ([b3d89c1](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/b3d89c18e7611eef4327037bd4c6ba0f0d9e9ea9))

### Features

- support nestjs 10 ([faec7f0](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/faec7f053bb5b10de1122bb3c3d3f88aad73125a))

## [4.1.2](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.1.1...v4.1.2) (2022-12-22)

### Bug Fixes

- skip pub-sub event registration in test mode ([cadfac0](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/cadfac09677401bb42e71ad2075b52b91f54f2d1))

## [4.1.1](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.1.0...v4.1.1) (2022-09-26)

### Bug Fixes

- use last split package name part as queue name prefix ([76ac63a](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/76ac63a736b476aa93f3f03e9414b04db369c128))

# [4.1.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.0.3...v4.1.0) (2022-09-19)

### Features

- add queue name prefix parameter to consumer options ([8279fc2](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/8279fc29fc1029032e048106e2d76b56898f0f9a))

## [4.0.3](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.0.2...v4.0.3) (2022-09-05)

### Bug Fixes

- use optional access to message headers ([0b3b4d2](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/0b3b4d2af1893ff9d61a713a0c7cdd5e15d2a0e1))

## [4.0.2](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v4.0.1...v4.0.2) (2022-07-18)

### Bug Fixes

- add isGlobal parameter to async module options ([083bd7a](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/083bd7aaa0ecee8c7943215f7e0342846972131d))

## [4.0.1](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v3.0.2...v4.0.1) (2022-06-27)

### Bug Fixes

- correct default retry delay function ([48db4a3](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/48db4a3f505b936c2aec3826fd516c58a5e39db4))

### chore

- drop support amqp-connection-manager@3 ([bd6a2c3](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/bd6a2c3bb19af1882e499d49a98855b4f8afc857))

### Features

- implement retry mechanism via queues with dead letter exchange and per-message ttl ([15affec](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/15affecaeeaa1d54ae42f5b60afeff27ee837260))

### BREAKING CHANGES

- Queue with dead letter exchange and per-message ttl is now the new default retry
  strategy
- `amqp-connection-manager@3` is no longer supported

## [3.0.2](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v3.0.1...v3.0.2) (2022-05-26)

### Bug Fixes

- correct default retry delay to exp seconds ([51c9361](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/51c9361e8c95328596b729c47495960084b9ae0b))

## [3.0.1](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.3.3...v3.0.1) (2022-05-25)

### Code Refactoring

- move queue name and binding options from event handler class fields to decorator ([d59b65c](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/d59b65c352ace7acc0bc1b2d239b23101679d14c))

### Features

- add error when application is started without npm scripts ([a09db22](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/a09db220ea3d951e2a28b28f552d543a5f907e28))
- add handler bound lifecycle event ([9836106](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/983610650462fa1df73509a571cf44b27ce843d2))
- add on retry attempts exceeded event ([de98a94](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/de98a94444d3c63c376e9ccd6a5e94b908dd33b1))
- expose connection manager options ([03f192e](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/03f192ea903d344b90f9a2b7b718678fc10ba374))
- implement retry mechanism via delayed message exchange ([b762a8a](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/b762a8a30f79be40cbd0c27f36bd7ccb8a45e13f))

### BREAKING CHANGES

- Queue name and binding options were removed from the event handler and moved to the
  pub-sub handler decorator

### [2.3.3](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.3.2...v2.3.3) (2022-03-23)

### Bug Fixes

- **log:** log correct exchanges bound to queue ([5e59ba62](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/5e59ba6229bdb6bfb9fb2d0380eff6652a116e39))
- remove event handler binding by event name ([80128a09](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/80128a09e45c53130b81a412e3f04bffe056a877))

### [2.3.2](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.3.1...v2.3.2) (2022-03-17)

### Bug Fixes

- **consumer:** match all to fan out events ([0173f94](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/0173f94fc23cd049e3eed4bbf8fc3bf84da08c4c))

### [2.3.1](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.3.0...v2.3.1) (2022-03-14)

### Bug Fixes

- support cqrs 8.0.2 ([1cb9a8a](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/1cb9a8ad93ff70aa042c98e36014fa2abef19767))

## [2.3.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.2.0...v2.3.0) (2022-01-26)

### Features

- add connection name option ([0d082e4](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/0d082e448731ba53db68503b09362924b1901d0c))

## [2.2.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.1.0...v2.2.0) (2022-01-11)

### Features

- **consumer:** do not open consumer amqp connection when no pub-sub handlers discovered ([41a907b](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/41a907bc942ae7e3db8a739231e973692eed670f))

## [2.1.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.0.1...v2.1.0) (2022-01-04)

### Features

- upgrade deps ([117dd5e9](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/117dd5e9801a178463a0bde9fa8772c2df26bbc5))

### [2.0.2](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.0.1...v2.0.2) (2021-11-11)

### Changes

- add support for nodejs versions 14 and 16 ([6fb2f8f](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/6fb2f8ff9c6fc01474eaee6df2aa2ef996e5266a))

### [2.0.1](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v2.0.0...v2.0.1) (2021-10-26)

### Bug Fixes

- allow non-pubsub events publishing ([d821816](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/d8218161af2a5a389d79942584c9eaebea523fd8))

## [2.0.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v1.5.2...v2.0.0) (2021-09-17)

### ⚠ BREAKING CHANGES

- Refer to Migration Guide from 1.5.2 to 2.0.0
- **event:** Event paylod is no longer a method, but a field. It should not be invoked to
  retrieve its content
- **event:** Pub-sub events are no more locally published by default. To publish the event both
  to RabbitMQ and locally use the `withLocal` event configuration method
- **event-bus:** EventBus `publish` and `publishAll` methods now return promises that should be
  properly handled

### Features

- **event-handler:** catch and log unhandled exceptions ([d4f3687](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/d4f3687f323e59875ff79637d72b1549513f2bc4))
- **event:** make message field private ([3968a4e](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/3968a4eada77b616619360ebfaf1b7fdb60d26d6))
- move exchange to the event decorator ([6fbee96](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/6fbee962aef1062e089ff9c602b0204b87f5263f))

- **event-bus:** make publish methods async ([427f441](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/427f4413cf9c4a3c61071b05bd1d63a7bb079f5e))
- **event:** do not publish event locally by default ([6b6df40](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/6b6df40eadb8f1d6f0132c508c5f9051b0710c85))
- **event:** replace payload method with readonly field ([42404bd](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/42404bd55e5fdfd0a2bdeac77d0b3161334f3ce6))

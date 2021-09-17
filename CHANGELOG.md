# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0](https://github.com/goparrot/nestjs-pubsub-event-bus/compare/v1.5.2...v2.0.0) (2021-09-17)


### ⚠ BREAKING CHANGES

* Refer to Migration Guide from 1.5.2 to 2.0.0
* **event:** Event paylod is no longer a method, but a field. It should not be invoked to
retrieve its content
* **event:** Pub-sub events are no more locally published by default. To publish the event both
to RabbitMQ and locally use the `withLocal` event configuration method
* **event-bus:** EventBus `publish` and `publishAll` methods now return promises that should be
properly handled

### Features

* **event-handler:** catch and log unhandled exceptions ([15cc9f4](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/15cc9f45d05414726d914e6fb96048856391241c))
* **event:** make message field private ([18fe7bb](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/18fe7bbf5679cbf077f9ebd3009b450357aeca9a))
* move exchange to the event decorator ([f352152](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/f3521520f0ceaba2d2f36e7f6598b36fa30e0929))


* **event-bus:** make publish methods async ([4b8c50d](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/4b8c50d455c0def642143cf7050c1986a2e7ee84))
* **event:** do not publish event locally by default ([c2edcc2](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/c2edcc20a410d0ba1bdb773294d94e1fb9ee2574))
* **event:** replace payload method with readonly field ([4c4a544](https://github.com/goparrot/nestjs-pubsub-event-bus/commit/4c4a5448e36240c495e81d8c944480ce4982214c))

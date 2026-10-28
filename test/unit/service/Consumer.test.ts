import type { LoggerService } from '@nestjs/common';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { BindingQueueOptions, EventBus, IHandlerWrapper } from '../../../src';
import { Consumer } from '../../../src';
import type { PrepareHandlerStrategies, RetryStrategies } from '../../../src/provider';
import { LoggerProvider } from '../../../src/provider';
import { DEFAULT_RETRY_OPTIONS } from '../../../src/utils/configuration';

type ConsumeCallback = (message: ConsumeMessage | null) => void;

describe('Consumer', () => {
    const nodeEnv = process.env.NODE_ENV;
    let consumer: Consumer;
    let eventBus: { publish: jest.Mock };
    let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
    let topologyChannel: { on: jest.Mock; assertExchange: jest.Mock; assertQueue: jest.Mock; bindQueue: jest.Mock; close: jest.Mock };
    let consumerChannel: { once: jest.Mock; consume: jest.Mock };

    class TestEvent {}
    class TestHandler {}

    const handlerWrapper = {
        handler: TestHandler,
        eventWrappers: [{ event: TestEvent, options: { exchange: 'test-exchange' } }],
        options: {},
        queue: 'test-queue',
    } as unknown as IHandlerWrapper;

    beforeEach(async () => {
        process.env.NODE_ENV = 'development';
        jest.useFakeTimers();

        logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        LoggerProvider.forLogger(logger as unknown as LoggerService);

        eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
        consumer = new Consumer(
            eventBus as unknown as EventBus,
            {} as RetryStrategies,
            {},
            DEFAULT_RETRY_OPTIONS,
            {} as BindingQueueOptions,
            {} as PrepareHandlerStrategies,
        );

        topologyChannel = {
            on: jest.fn(),
            assertExchange: jest.fn(),
            assertQueue: jest.fn(),
            bindQueue: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
        };
        Reflect.set(consumer, 'connection$', { connection: { createChannel: jest.fn().mockResolvedValue(topologyChannel) }, close: jest.fn() });
        Reflect.set(consumer, 'channelWrapper$', { addSetup: jest.fn(async (setup: () => Promise<void>) => setup()), close: jest.fn() });

        consumerChannel = { once: jest.fn(), consume: jest.fn().mockResolvedValue({ consumerTag: 'consumer-tag' }) };
        await consumer.setupChannel(consumerChannel as unknown as ConfirmChannel);
    });

    afterEach(async () => {
        await consumer.onModuleDestroy();
        jest.useRealTimers();
        process.env.NODE_ENV = nodeEnv;
    });

    it('should subscribe again when the broker cancels the consumer together with the consume reply', async () => {
        // amqplib can run the consumer callback for a cancel that arrives in the same read as the consume reply, before
        // the reply resolves
        consumerChannel.consume.mockImplementationOnce(async (_queue: string, onMessage: ConsumeCallback) => {
            onMessage(null);
            return { consumerTag: 'cancelled-consumer-tag' };
        });

        await consumer.consume(handlerWrapper, jest.fn());
        expect(consumerChannel.consume).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1000);

        expect(consumerChannel.consume).toHaveBeenCalledTimes(2);
    });

    it('should not consume again when publishing HandlerBound fails', async () => {
        eventBus.publish.mockRejectedValueOnce(new Error('HandlerBound listener failed'));

        await consumer.consume(handlerWrapper, jest.fn());
        await jest.advanceTimersByTimeAsync(10_000);

        expect(consumerChannel.consume).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('HandlerBound listener failed'));
    });

    it('should log a set-up failure as an error once it has lasted a minute', async () => {
        topologyChannel.assertQueue.mockRejectedValue(new Error('NOT_FOUND - home node is down'));

        await consumer.consume(handlerWrapper, jest.fn());
        await jest.advanceTimersByTimeAsync(50_000);
        expect(logger.error).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(20_000);

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to set up queue "test-queue"'));
        expect(consumerChannel.consume).not.toHaveBeenCalled();
    });
});

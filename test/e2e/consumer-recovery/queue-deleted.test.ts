import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Channel, Connection } from 'amqplib';
import { connect } from 'amqplib';
import { AbstractPubsubEvent, AbstractPubsubHandler, AutoAckEnum, Consumer, EventBus, PubsubEvent, PubsubEventHandler, RetryStrategyEnum } from '../../../src';
import { LoggerProvider } from '../../../src/provider';
import { CountDownLatch, countDisconnects, TestingCqrsModule, waitHandlerBound } from '../../util';

describe('Consumer recovery after the queue is deleted', () => {
    const queue = faker.string.uuid();
    const retryQueue = faker.string.uuid();
    let testingModule: TestingModule;
    let eventBus: EventBus;
    let admin: Connection;
    let adminChannel: Channel;
    let disconnects: () => number;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: faker.string.uuid() })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent, { queue })
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {
            latch.countDown();
        }
    }

    @PubsubEvent({ exchange: faker.string.uuid() })
    class RetriedEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(RetriedEvent, {
        queue: retryQueue,
        autoAck: AutoAckEnum.AUTO_RETRY,
        retryOptions: { maxRetryAttempts: 1, delay: 100, strategy: RetryStrategyEnum.DEAD_LETTER_TTL },
    })
    class RetriedHandler extends AbstractPubsubHandler<RetriedEvent> {
        async handle(event: RetriedEvent): Promise<void> {
            latch.countDown();
            if (!event.retryCount) {
                throw new Error('Failed on the first attempt');
            }
        }
    }

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [TestingCqrsModule],
            providers: [TestHandler, RetriedHandler],
        }).compile();

        await testingModule.init();

        eventBus = testingModule.get(EventBus);
        await Promise.all([waitHandlerBound(eventBus, TestHandler), waitHandlerBound(eventBus, RetriedHandler)]);

        disconnects = countDisconnects(testingModule.get(Consumer));

        admin = await connect('amqp://localhost:5672');
        adminChannel = await admin.createChannel();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await admin.close();
        await testingModule.close();
    });

    it('should re-subscribe without reconnecting', async () => {
        const warn = jest.spyOn(LoggerProvider.logger, 'warn');
        const bound = waitHandlerBound(eventBus, TestHandler);

        await adminChannel.deleteQueue(queue);
        await bound;

        latch = new CountDownLatch(1);
        await eventBus.publish(new TestEvent({ foo: faker.lorem.word() }));
        await latch.wait();

        expect(warn).toHaveBeenCalledWith(`The broker cancelled the consumer of queue "${queue}", subscribing again`);
        expect(disconnects()).toBe(0);
    });

    it('should restore the retry binding of the re-declared queue', async () => {
        const handle = jest.spyOn(testingModule.get(RetriedHandler), 'handle');
        const bound = waitHandlerBound(eventBus, RetriedHandler);

        await adminChannel.deleteQueue(retryQueue);
        await bound;

        latch = new CountDownLatch(2);
        await eventBus.publish(new RetriedEvent({ foo: faker.lorem.word() }));
        await latch.wait();

        expect(handle).toHaveBeenNthCalledWith(1, expect.objectContaining({ retryCount: 0 }));
        expect(handle).toHaveBeenNthCalledWith(2, expect.objectContaining({ retryCount: 1 }));
        expect(disconnects()).toBe(0);
    });
});

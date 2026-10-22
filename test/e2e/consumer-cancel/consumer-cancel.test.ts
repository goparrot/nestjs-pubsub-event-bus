import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import * as amqplib from 'amqplib';
import { AbstractPubsubEvent, AbstractPubsubHandler, CqrsModule, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';
import { LoggerProvider } from '../../../src/provider';
import { CountDownLatch, waitHandlerBound } from '../../util';

const RABBITMQ_URL = 'amqp://localhost:5672';

describe('Consumer cancelled by the broker', () => {
    const queue = faker.string.uuid();
    let testingModule: TestingModule;
    let eventBus: EventBus;
    let testHandler: TestHandler;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: faker.string.uuid() })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent, { queue })
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {
            latch.countDown();
        }
    }

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [
                CqrsModule.forRoot({
                    connections: [RABBITMQ_URL],
                    config: {
                        exchange: { autoDelete: true, durable: false },
                        bindings: { autoDelete: true, durable: false },
                        connectionManagerOptions: { reconnectTimeInSeconds: 1 },
                    },
                }),
            ],
            providers: [TestHandler],
        }).compile();

        await testingModule.init();

        eventBus = testingModule.get(EventBus);
        testHandler = testingModule.get(TestHandler);

        await waitHandlerBound(eventBus, TestHandler);
    });

    beforeEach(() => {
        latch = new CountDownLatch(1);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await testingModule.close();
    });

    it('should re-subscribe and keep consuming events after the queue is deleted', async () => {
        const warnSpy = jest.spyOn(LoggerProvider.logger, 'warn');
        const handleSpy = jest.spyOn(testHandler, 'handle');
        const handlerRebound = waitHandlerBound(eventBus, TestHandler);

        // Deleting the queue makes the broker send `basic.cancel`, as it does when the queue's node goes down
        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.deleteQueue(queue);
        await connection.close();

        await handlerRebound;

        const payload: Record<string, unknown> = { foo: faker.lorem.word() };
        await eventBus.publish(new TestEvent(payload));

        await latch.wait();

        expect(warnSpy).toHaveBeenCalledWith(`Consumer of queue "${queue}" was cancelled by the broker, re-subscribing`);
        expect(handleSpy).toHaveBeenCalledWith(expect.objectContaining({ payload }));
    }, 30000);
});

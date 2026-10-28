import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { connect } from 'amqplib';
import { AbstractPubsubEvent, AbstractPubsubHandler, Consumer, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';
import { LoggerProvider } from '../../../src/provider';
import { CountDownLatch, countDisconnects, TestingCqrsModule, waitFor, waitHandlerBound } from '../../util';

describe('Consumer recovery while a queue is unavailable', () => {
    const unavailableQueue = faker.string.uuid();
    const healthyQueue = faker.string.uuid();
    let testingModule: TestingModule;
    let eventBus: EventBus;
    let disconnects: () => number;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: faker.string.uuid() })
    class UnavailableEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(UnavailableEvent, { queue: unavailableQueue })
    class UnavailableHandler extends AbstractPubsubHandler<UnavailableEvent> {
        async handle(_event: UnavailableEvent): Promise<void> {
            latch.countDown();
        }
    }

    @PubsubEvent({ exchange: faker.string.uuid() })
    class HealthyEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(HealthyEvent, { queue: healthyQueue })
    class HealthyHandler extends AbstractPubsubHandler<HealthyEvent> {
        async handle(_event: HealthyEvent): Promise<void> {
            latch.countDown();
        }
    }

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [TestingCqrsModule],
            providers: [UnavailableHandler, HealthyHandler],
        }).compile();

        await testingModule.init();

        eventBus = testingModule.get(EventBus);
        await Promise.all([waitHandlerBound(eventBus, UnavailableHandler), waitHandlerBound(eventBus, HealthyHandler)]);

        disconnects = countDisconnects(testingModule.get(Consumer));
    });

    afterAll(async () => {
        await testingModule.close();
    });

    it('should keep the connection and the other consumers until the queue can be declared again', async () => {
        const warn = jest.spyOn(LoggerProvider.logger, 'warn');

        // An exclusive queue of another connection makes every declaration of the same queue fail, like a queue whose
        // node is down
        const locker = await connect('amqp://localhost:5672');
        let bound: Promise<void>;

        try {
            const lockerChannel = await locker.createChannel();
            await lockerChannel.deleteQueue(unavailableQueue);
            await lockerChannel.assertQueue(unavailableQueue, { exclusive: true });

            await waitFor(() => warn.mock.calls.some(([message]: unknown[]) => String(message).startsWith(`Failed to set up queue "${unavailableQueue}"`)));

            latch = new CountDownLatch(1);
            await eventBus.publish(new HealthyEvent({ foo: faker.lorem.word() }));
            await latch.wait();

            bound = waitHandlerBound(eventBus, UnavailableHandler);
        } finally {
            await locker.close();
        }
        await bound;

        latch = new CountDownLatch(1);
        await eventBus.publish(new UnavailableEvent({ foo: faker.lorem.word() }));
        await latch.wait();

        expect(disconnects()).toBe(0);
    }, 30_000);
});

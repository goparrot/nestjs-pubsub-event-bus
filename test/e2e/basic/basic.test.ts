import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AbstractPubsubEvent, AbstractPubsubHandler, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';
import { CountDownLatch, TestingCqrsModule, waitHandlerBound } from '../../util';

describe('Basic Scenarios', () => {
    let testingModule: TestingModule;
    let eventBus: EventBus;
    let testHandler: TestHandler;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: faker.string.uuid() })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent, { queue: faker.string.uuid(), bindingQueueOptions: { autoDelete: true } })
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {
            latch.countDown();
        }
    }

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [TestingCqrsModule],
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
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await testingModule.close();
    });

    it('should publish and consume the event', async () => {
        const spy = jest.spyOn(testHandler, 'handle');

        const payload: Record<string, unknown> = {
            foo: faker.lorem.word(),
        };
        const testEvent = new TestEvent(payload);

        await eventBus.publish(testEvent);

        await latch.wait();

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ payload, options: {}, fireLocally: false, retryCount: 0 }));
    });
});

import faker from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import _ from 'lodash';
import { AbstractPubsubEvent, AbstractPubsubHandler, AutoAckEnum, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';
import { CountDownLatch, TestingCqrsModule, waitHandlerBound } from '../../util';

describe('Retry Scenarios', () => {
    const maxRetryAttempts = 3;
    const delayFactory = (attempt: number): number => attempt * 100;
    let testingModule: TestingModule;
    let eventBus: EventBus;
    let testHandler: TestHandler;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: faker.datatype.uuid() })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent, {
        autoAck: AutoAckEnum.AUTO_RETRY,
        retryOptions: {
            maxRetryAttempts,
            delay: delayFactory,
        },
        queue: faker.datatype.uuid(),
        bindingQueueOptions: { autoDelete: true },
    })
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(event: TestEvent): Promise<void> {
            if (event.retryCount <= maxRetryAttempts) {
                throw new Error(`Failed on ${event.retryCount} attempt`);
            }
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
        const expectedTime = _.times(maxRetryAttempts + 1, delayFactory).reduce((acc: number, val: number) => acc + val, 0);

        const start = Date.now();
        await eventBus.publish(testEvent);

        await latch.wait();
        expect(Date.now() - start).toBeGreaterThanOrEqual(expectedTime);

        _.times(maxRetryAttempts + 1, (retryAttempt: number) => {
            expect(spy).toHaveBeenNthCalledWith(
                retryAttempt + 1,
                expect.objectContaining({
                    payload,
                    options: {},
                    fireLocally: false,
                    retryCount: retryAttempt,
                }),
            );
        });
    });
});

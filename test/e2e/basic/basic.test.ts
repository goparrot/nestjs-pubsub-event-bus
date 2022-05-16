import faker from '@faker-js/faker';
import type { IEvent } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { first, firstValueFrom } from 'rxjs';
import { AbstractPubsubEvent, AbstractPubsubHandler, CqrsModule, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';
import { HandlerBound } from '../../../src/lifecycle-event';
import { CountDownLatch } from '../../util';

describe('Basic Scenarios', () => {
    const fakeExchange = 'test';

    let testingModule: TestingModule;
    let eventBus: EventBus;
    let testHandler: TestHandler;
    let latch: CountDownLatch;

    @PubsubEvent({ exchange: fakeExchange })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent)
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {
            latch.countDown();
        }
    }

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [CqrsModule.forRoot({ connections: ['amqp://localhost:5672'] })],
            providers: [TestHandler],
        }).compile();

        await testingModule.init();

        eventBus = testingModule.get(EventBus);
        testHandler = testingModule.get(TestHandler);

        await firstValueFrom(eventBus.subject$.pipe(first((event: IEvent) => event instanceof HandlerBound && event.handlerName === TestHandler.name)));
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

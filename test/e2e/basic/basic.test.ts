import faker from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AbstractPubsubEvent, AbstractPubsubHandler, CqrsModule, EventBus, PubsubEvent, PubsubEventHandler } from '../../../src';

class CountDownLatch {
    private resolvePromise: () => void;
    private promise = new Promise<void>((resolve: () => void) => {
        this.resolvePromise = resolve;
    });

    constructor(private _count: number) {
        if (_count < 1) {
            throw new Error();
        }
    }

    countDown(): void {
        if (!this._count) {
            throw new Error();
        }
        this._count--;

        if (!this._count) {
            this.resolvePromise();
        }
    }

    get count(): number {
        return this._count;
    }

    async wait(): Promise<void> {
        return this.promise;
    }
}

describe('Basic Scenarios', () => {
    const fakeExchange = 'test';

    @PubsubEvent({ exchange: fakeExchange })
    class TestEvent extends AbstractPubsubEvent<Record<string, unknown>> {}

    @PubsubEventHandler(TestEvent)
    class TestHandler extends AbstractPubsubHandler<TestEvent> {
        async handle(_event: TestEvent): Promise<void> {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            latch.countDown();
        }
    }

    let testingModule: TestingModule;
    let eventBus: EventBus;
    let testHandler: TestHandler;
    let latch: CountDownLatch;

    beforeAll(async () => {
        process.env.NODE_ENV = 'development';

        testingModule = await Test.createTestingModule({
            imports: [CqrsModule.forRoot({ connections: ['amqp://localhost:5672'] })],
            providers: [TestHandler],
        }).compile();

        await testingModule.init();

        eventBus = testingModule.get(EventBus);
        testHandler = testingModule.get(TestHandler);
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

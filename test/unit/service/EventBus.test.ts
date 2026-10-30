import type { Type } from '@nestjs/common';
import * as NestCqrs from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CqrsModule, EventBus } from '../../../src';

describe('EventBus', () => {
    let testingModule: TestingModule;

    beforeEach(async () => {
        testingModule = await Test.createTestingModule({
            imports: [CqrsModule.forRoot({ connections: ['amqp://localhost:5672'] })],
        }).compile();
    });

    afterEach(async () => {
        await testingModule.close();
    });

    it('should get the UnhandledExceptionBus of @nestjs/cqrs, if it has one', () => {
        const NestUnhandledExceptionBus = Reflect.get(NestCqrs, 'UnhandledExceptionBus') as Type | undefined;
        const unhandledExceptionBus: unknown = NestUnhandledExceptionBus && testingModule.get(NestUnhandledExceptionBus);

        expect(Reflect.get(testingModule.get(EventBus), 'unhandledExceptionBus')).toBe(unhandledExceptionBus);
    });
});

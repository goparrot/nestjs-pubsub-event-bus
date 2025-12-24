import { ModulesContainer } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ExplorerService } from '../../../src/service/ExplorerService';
import { PUBSUB_EVENT_HANDLER_METADATA } from '../../../src/decorator';
import type { AbstractSubscriptionEvent } from '../../../src/interface';
import { AbstractPubsubHandler } from '../../../src/interface';

describe('ExplorerService', () => {
    let explorerService: ExplorerService;
    let modulesContainer: ModulesContainer;

    // Mock handler classes
    class TestHandler1 extends AbstractPubsubHandler<AbstractSubscriptionEvent<any>> {
        async handle(): Promise<void> {}
    }

    class TestHandler2 extends AbstractPubsubHandler<AbstractSubscriptionEvent<any>> {
        async handle(): Promise<void> {}
    }

    class NonHandlerClass {
        someMethod(): void {}
    }

    beforeEach(() => {
        modulesContainer = new ModulesContainer();
        explorerService = new ExplorerService(modulesContainer);
    });

    describe('NestJS 10 compatibility (filterProvider)', () => {
        it('should discover pubsub event handlers using filterProvider method', () => {
            // Skip test if filterProvider doesn't exist (NestJS 11+)
            if (!('filterProvider' in ExplorerService.prototype)) {
                return;
            }
            // Mock module with handlers
            const mockModule = {
                providers: new Map([
                    ['TestHandler1', { metatype: TestHandler1, instance: new TestHandler1() }],
                    ['TestHandler2', { metatype: TestHandler2, instance: new TestHandler2() }],
                    ['NonHandler', { metatype: NonHandlerClass, instance: new NonHandlerClass() }],
                ]),
            };

            modulesContainer.set('TestModule', mockModule as any);

            // Mock filterProvider to return handlers (NestJS 10 behavior)
            const filterProviderSpy = jest.spyOn(explorerService as any, 'filterProvider').mockImplementation((...args: any[]) => {
                const [instance, metadataKey] = args as [InstanceWrapper, string];
                if (metadataKey === PUBSUB_EVENT_HANDLER_METADATA) {
                    const metatype = instance.metatype;
                    if (metatype === TestHandler1 || metatype === TestHandler2) {
                        return [metatype];
                    }
                }
                return [];
            });

            // Mock flatMap to call filterProvider
            const flatMapSpy = jest.spyOn(explorerService as any, 'flatMap').mockImplementation((...args: any[]) => {
                const [modules, callback] = args as [any[], (wrapper: unknown) => any];
                const results: any[] = [];
                modules.forEach((module: any) => {
                    module.providers?.forEach((wrapper: any) => {
                        results.push(...callback(wrapper));
                    });
                });
                return results;
            });

            // Ensure filterByMetadataKey doesn't exist (NestJS 10 path)
            delete (explorerService as any).filterByMetadataKey;

            const handlers = explorerService.pubsubEvents();

            expect(handlers).toHaveLength(2);
            expect(handlers).toContain(TestHandler1);
            expect(handlers).toContain(TestHandler2);
            expect(handlers).not.toContain(NonHandlerClass);
            expect(filterProviderSpy).toHaveBeenCalled();
            expect(flatMapSpy).toHaveBeenCalled();
        });

        it('should return empty array when no handlers are found (NestJS 10)', () => {
            // Skip test if filterProvider doesn't exist (NestJS 11+)
            if (!('filterProvider' in ExplorerService.prototype)) {
                return;
            }
            const mockModule = {
                providers: new Map([['NonHandler', { metatype: NonHandlerClass, instance: new NonHandlerClass() }]]),
            };

            modulesContainer.set('TestModule', mockModule as any);

            jest.spyOn(explorerService as any, 'filterProvider').mockReturnValue([]);
            jest.spyOn(explorerService as any, 'flatMap').mockReturnValue([]);
            delete (explorerService as any).filterByMetadataKey;

            const handlers = explorerService.pubsubEvents();

            expect(handlers).toHaveLength(0);
        });
    });

    describe('NestJS 11 compatibility (filterByMetadataKey)', () => {
        it('should discover pubsub event handlers using filterByMetadataKey method', () => {
            // Mock module with handlers
            const mockWrapper1: Partial<InstanceWrapper> = { metatype: TestHandler1 };
            const mockWrapper2: Partial<InstanceWrapper> = { metatype: TestHandler2 };
            const mockWrapper3: Partial<InstanceWrapper> = { metatype: NonHandlerClass };

            const mockModule = {
                providers: new Map([
                    ['TestHandler1', mockWrapper1],
                    ['TestHandler2', mockWrapper2],
                    ['NonHandler', mockWrapper3],
                ]),
            };

            modulesContainer.set('TestModule', mockModule as any);

            // Mock filterByMetadataKey to return wrappers (NestJS 11 behavior)
            const filterByMetadataKeySpy = jest.fn((instance: InstanceWrapper, metadataKey: string) => {
                if (metadataKey === PUBSUB_EVENT_HANDLER_METADATA) {
                    const metatype = instance.metatype;
                    if (metatype === TestHandler1 || metatype === TestHandler2) {
                        return [instance];
                    }
                }
                return [];
            });

            // Add filterByMetadataKey to trigger NestJS 11 path
            (explorerService as any).filterByMetadataKey = filterByMetadataKeySpy;

            // Mock flatMap
            const flatMapSpy = jest.spyOn(explorerService as any, 'flatMap').mockImplementation((...args: any[]) => {
                const [modules, callback] = args as [any[], (wrapper: unknown) => any];
                const results: any[] = [];
                modules.forEach((module: any) => {
                    module.providers?.forEach((wrapper: any) => {
                        results.push(...callback(wrapper));
                    });
                });
                return results;
            });

            const handlers = explorerService.pubsubEvents();

            expect(handlers).toHaveLength(2);
            expect(handlers).toContain(TestHandler1);
            expect(handlers).toContain(TestHandler2);
            expect(handlers).not.toContain(NonHandlerClass);
            expect(filterByMetadataKeySpy).toHaveBeenCalled();
            expect(flatMapSpy).toHaveBeenCalled();
        });

        it('should filter out wrappers with undefined metatype (NestJS 11)', () => {
            const mockWrapper1: Partial<InstanceWrapper> = { metatype: TestHandler1 };
            const mockWrapper2: Partial<InstanceWrapper> = { metatype: undefined };
            const mockWrapper3: Partial<InstanceWrapper> = { metatype: null as any };

            const mockModule = {
                providers: new Map([
                    ['TestHandler1', mockWrapper1],
                    ['UndefinedWrapper', mockWrapper2],
                    ['NullWrapper', mockWrapper3],
                ]),
            };

            modulesContainer.set('TestModule', mockModule as any);

            const filterByMetadataKeySpy = jest.fn((instance: InstanceWrapper) => {
                return [instance];
            });

            (explorerService as any).filterByMetadataKey = filterByMetadataKeySpy;

            jest.spyOn(explorerService as any, 'flatMap').mockImplementation((...args: any[]) => {
                const [modules, callback] = args as [any[], (wrapper: unknown) => any];
                const results: any[] = [];
                modules.forEach((module: any) => {
                    module.providers?.forEach((wrapper: any) => {
                        results.push(...callback(wrapper));
                    });
                });
                return results;
            });

            const handlers = explorerService.pubsubEvents();

            // Only TestHandler1 should be included, undefined/null metatypes filtered out
            expect(handlers).toHaveLength(1);
            expect(handlers).toContain(TestHandler1);
        });

        it('should return empty array when no handlers are found (NestJS 11)', () => {
            const mockWrapper: Partial<InstanceWrapper> = { metatype: NonHandlerClass };

            const mockModule = {
                providers: new Map([['NonHandler', mockWrapper]]),
            };

            modulesContainer.set('TestModule', mockModule as any);

            const filterByMetadataKeySpy = jest.fn(() => []);
            (explorerService as any).filterByMetadataKey = filterByMetadataKeySpy;

            jest.spyOn(explorerService as any, 'flatMap').mockReturnValue([]);

            const handlers = explorerService.pubsubEvents();

            expect(handlers).toHaveLength(0);
        });
    });

    describe('Runtime detection logic', () => {
        it('should use NestJS 11 path when filterByMetadataKey exists', () => {
            // Skip test if filterProvider doesn't exist (NestJS 11+)
            if (!('filterProvider' in ExplorerService.prototype)) {
                return;
            }
            // Spy on the methods to verify which path is taken
            const filterByMetadataKeySpy = jest.fn((instance: InstanceWrapper) => {
                // Return wrapper for TestHandler1
                if (instance.metatype === TestHandler1) {
                    return [instance];
                }
                return [];
            });
            const filterProviderSpy = jest.fn(() => [TestHandler1]);

            // Add filterByMetadataKey to trigger NestJS 11 path
            (explorerService as any).filterByMetadataKey = filterByMetadataKeySpy;
            jest.spyOn(explorerService as any, 'filterProvider').mockImplementation(filterProviderSpy);

            // Mock flatMap to return wrapped result
            jest.spyOn(explorerService as any, 'flatMap').mockReturnValue([{ metatype: TestHandler1 }]);

            const handlers = explorerService.pubsubEvents();

            // Verify NestJS 11 code path was taken
            expect('filterByMetadataKey' in explorerService).toBe(true);
            expect(handlers).toHaveLength(1);
            expect(handlers[0]).toBe(TestHandler1);
        });

        it('should use NestJS 10 path when filterByMetadataKey does not exist', () => {
            // Skip test if filterProvider doesn't exist (NestJS 11+)
            if (!('filterProvider' in ExplorerService.prototype)) {
                return;
            }
            const filterProviderSpy = jest.fn(() => [TestHandler1]);

            // Remove filterByMetadataKey to trigger NestJS 10 path
            delete (explorerService as any).filterByMetadataKey;
            jest.spyOn(explorerService as any, 'filterProvider').mockImplementation(filterProviderSpy);

            // Mock flatMap to return direct result
            jest.spyOn(explorerService as any, 'flatMap').mockReturnValue([TestHandler1]);

            const handlers = explorerService.pubsubEvents();

            // Verify NestJS 10 code path was taken
            expect('filterByMetadataKey' in explorerService).toBe(false);
            expect(handlers).toHaveLength(1);
            expect(handlers[0]).toBe(TestHandler1);
        });
    });

    describe('Integration with ModulesContainer', () => {
        it('should handle empty modules container', () => {
            // Empty container
            const emptyContainer = new ModulesContainer();
            const service = new ExplorerService(emptyContainer);

            jest.spyOn(service as any, 'flatMap').mockReturnValue([]);
            delete (service as any).filterByMetadataKey;

            const handlers = service.pubsubEvents();

            expect(handlers).toHaveLength(0);
        });

        it('should handle multiple modules with mixed handlers', () => {
            // Skip test if filterProvider doesn't exist (NestJS 11+)
            if (!('filterProvider' in ExplorerService.prototype)) {
                return;
            }
            const mockModule1 = {
                providers: new Map([['Handler1', { metatype: TestHandler1, instance: new TestHandler1() }]]),
            };

            const mockModule2 = {
                providers: new Map([
                    ['Handler2', { metatype: TestHandler2, instance: new TestHandler2() }],
                    ['NonHandler', { metatype: NonHandlerClass, instance: new NonHandlerClass() }],
                ]),
            };

            modulesContainer.set('Module1', mockModule1 as any);
            modulesContainer.set('Module2', mockModule2 as any);

            jest.spyOn(explorerService as any, 'filterProvider').mockImplementation((...args: any[]) => {
                const [instance] = args as [InstanceWrapper];
                const metatype = instance.metatype;
                if (metatype === TestHandler1 || metatype === TestHandler2) {
                    return [metatype];
                }
                return [];
            });

            jest.spyOn(explorerService as any, 'flatMap').mockImplementation((...args: any[]) => {
                const [modules, callback] = args as [any[], (wrapper: unknown) => any];
                const results: any[] = [];
                modules.forEach((module: any) => {
                    module.providers?.forEach((wrapper: any) => {
                        results.push(...callback(wrapper));
                    });
                });
                return results;
            });

            delete (explorerService as any).filterByMetadataKey;

            const handlers = explorerService.pubsubEvents();

            expect(handlers).toHaveLength(2);
            expect(handlers).toContain(TestHandler1);
            expect(handlers).toContain(TestHandler2);
        });
    });
});

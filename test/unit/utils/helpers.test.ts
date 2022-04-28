import { toEventClassName, toEventName, toSnakeCase } from '../../../src';

describe('Utils', () => {
    describe('toEventName', () => {
        it('should transform event class name to .dot notation', () => {
            expect(toEventName('UserCreated')).toBe('user.created');
            expect(toEventName('StoreRemoved')).toBe('store.removed');
            expect(toEventName('UserProfileUpdated')).toBe('user.profile.updated');
        });

        it('should disregard the Event word in a class name', () => {
            expect(toEventName('UserCreatedEvent')).toBe('user.created');
        });
    });

    describe('toEventClassName', () => {
        it('should transform the event name to a class name', () => {
            expect(toEventClassName('user.created')).toBe('UserCreated');
            expect(toEventClassName('store.removed')).toBe('StoreRemoved');
            expect(toEventClassName('user.profile.updated')).toBe('UserProfileUpdated');
        });
    });

    describe('toSnakeCase', () => {
        it('should transform a handler name to a snake case', function () {
            expect(toSnakeCase('NotifyUser')).toBe('notify_user');
        });

        it('should disregard the Handler word', function () {
            expect(toSnakeCase('NotifyUserHandler')).toBe('notify_user');
        });
    });
});

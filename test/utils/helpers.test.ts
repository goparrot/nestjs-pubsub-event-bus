import { toEventClassName, toEventName, toSnakeCase } from '../../src';

describe('Utils', () => {
    describe('toEventName', () => {
        it('should transform event class name to .dot notation', () => {
            expect(toEventName('UserCreated')).toEqual('user.created');
            expect(toEventName('StoreRemoved')).toEqual('store.removed');
            expect(toEventName('UserProfileUpdated')).toEqual('user.profile.updated');
        });

        it('should disregard the Event word in a class name', () => {
            expect(toEventName('UserCreatedEvent')).toEqual('user.created');
        });
    });

    describe('toEventClassName', () => {
        it('should transform the event name to a class name', () => {
            expect(toEventClassName('user.created')).toEqual('UserCreated');
            expect(toEventClassName('store.removed')).toEqual('StoreRemoved');
            expect(toEventClassName('user.profile.updated')).toEqual('UserProfileUpdated');
        });
    });

    describe('toSnakeCase', () => {
        it('should transform a handler name to a snake case', function () {
            expect(toSnakeCase('NotifyUser')).toEqual('notify_user');
        });

        it('should disregard the Handler word', function () {
            expect(toSnakeCase('NotifyUserHandler')).toEqual('notify_user');
        });
    });
});

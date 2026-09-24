import { Logger } from '@nestjs/common';
import { LoggerProvider } from '../../../src/provider';

describe('LoggerProvider', () => {
    const event = {
        payload: { userId: 'user-1', resetToken: 'secret-token', settings: { legacyPasswordHash: 'hash' } },
        options: { headers: { 'sentry-trace': 'trace-id' } },
    };

    describe('stringify', () => {
        it('should serialize the value unchanged when no keys are redacted', () => {
            LoggerProvider.forLogger(new Logger());

            expect(LoggerProvider.stringify(event)).toBe(JSON.stringify(event));
        });

        it('should replace the values of matching keys at any depth', () => {
            LoggerProvider.forLogger(new Logger(), /token|password/i);

            expect(JSON.parse(LoggerProvider.stringify({ event }))).toEqual({
                event: {
                    payload: { userId: 'user-1', resetToken: '[redacted]', settings: { legacyPasswordHash: '[redacted]' } },
                    options: { headers: { 'sentry-trace': 'trace-id' } },
                },
            });
        });

        it('should redact every matching key with a global pattern', () => {
            LoggerProvider.forLogger(new Logger(), /token/gi);

            expect(LoggerProvider.stringify({ activationToken: 'a', resetToken: 'b' })).toBe('{"activationToken":"[redacted]","resetToken":"[redacted]"}');
        });
    });
});

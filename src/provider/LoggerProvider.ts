import type { LoggerService } from '@nestjs/common';

const REDACTED_LOG_VALUE: string = '[redacted]';

export class LoggerProvider {
    static logger: LoggerService;
    static redactedLogKeys: RegExp | undefined;

    static forLogger(logger: LoggerService, redactedLogKeys?: RegExp): LoggerProvider {
        LoggerProvider.logger = logger;
        LoggerProvider.redactedLogKeys = redactedLogKeys;

        return new LoggerProvider();
    }

    /**
     * Serializes an event (or a structure holding one) for a log message, replacing the values of `redactedLogKeys` at any depth
     */
    static stringify(value: unknown): string {
        const redactedLogKeys: RegExp | undefined = LoggerProvider.redactedLogKeys;
        if (!redactedLogKeys) {
            return JSON.stringify(value);
        }

        // `search` ignores `lastIndex`, so a pattern with the global flag matches on every key
        return JSON.stringify(value, (key: string, nested: unknown): unknown => (key.search(redactedLogKeys) === -1 ? nested : REDACTED_LOG_VALUE));
    }
}

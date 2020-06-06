import { LoggerService } from '@nestjs/common';

export class LoggerProvider {
    static logger: LoggerService;

    static forLogger(logger: LoggerService): LoggerProvider {
        LoggerProvider.logger = logger;

        return new LoggerProvider();
    }
}

import { Module } from '@nestjs/common';
import { CqrsModule } from '../../src';

@Module({
    imports: [
        CqrsModule.forRoot({
            connections: ['amqp://localhost:5672'],
            config: {
                exchange: { autoDelete: true, durable: false },
                bindings: { autoDelete: true, durable: false },
            },
        }),
    ],
    exports: [CqrsModule],
})
export class TestingCqrsModule {}

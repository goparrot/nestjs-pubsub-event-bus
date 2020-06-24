import { ConfirmChannel, ConsumeMessage, Message, Replies } from 'amqplib';
import { toEventName, toSnakeCase } from '../utils';
import { BindingQueueOptions } from '../interface';
import { ConfigProvider } from '../provider';
import { PubsubManager } from './PubsubManager';

export class Consumer extends PubsubManager {
    protected name: string;

    setName(name: string): Consumer {
        this.name = name;

        return this;
    }

    /**
     * Listen for an event and consume its message payload
     *
     * @param exchange - exchange to be used
     * @param events - list of events to listen for
     * @param onMessage - a callback that receives an event message
     * @param bindingOptions - queue binding options
     */
    async consume(exchange: string, events: string[], onMessage: (msg: ConsumeMessage | null) => any, bindingOptions?: BindingQueueOptions): Promise<void> {
        await this.channel(
            exchange,
            async (channel: ConfirmChannel): Promise<void> => {
                try {
                    const queueName: string = this.queue(exchange);
                    const rabbitQueue: Replies.AssertQueue = await channel.assertQueue(queueName, this.bindingOptions(bindingOptions));
                    this.listenFor(events).map(async (event: string): Promise<any> => await channel.bindQueue(rabbitQueue.queue, exchange, event));

                    this.logger().log(`Listening for "${this.listenFor(events).toString()}" events from [${exchange} <- ${queueName}]`);
                    await channel.consume(rabbitQueue.queue, (msg: ConsumeMessage | null) => {
                        try {
                            onMessage(msg);
                            channel.ack(msg as Message);
                        } catch (e) {
                            // @tbd retry??? if so, retry mechanism maybe based on headers values...
                            this.logger().warn(`Message acknowledge error: [${(e as Error).message}]`);
                        }
                    });
                } catch (e) {
                    this.logger().warn(`Error listening: [${(e as Error).message}]`);
                }
            },
        );
    }

    /**
     * Event, that consumer should listen for (Ex.: order.created, user.*, *.created, etc...)
     */
    protected listenFor = (events?: string[]): string[] => {
        if (events?.length) {
            return events;
        }

        return [toEventName(this.constructor.name.replace(/Handler$/i, ''))];
    };

    /**
     * Queue that should be listened for events.
     */
    protected queue(exchange: string): string {
        const pckName: string = (process.env.npm_package_name as string).split('/').pop() as string;
        const platform = pckName.replace(/[_-]/gi, '.');

        return [exchange, platform, this.toConsumerClassName()].join(':');
    }

    protected bindingOptions(extra: BindingQueueOptions = {}): BindingQueueOptions {
        return {
            ...this.consumerConfiguration(),
            ...extra,
        };
    }

    protected consumerConfiguration(): BindingQueueOptions {
        return ConfigProvider.bindings;
    }

    protected toConsumerClassName(): string {
        return toSnakeCase(this.name || this.constructor.name);
    }
}

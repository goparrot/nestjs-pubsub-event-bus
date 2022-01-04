import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import type { IPubsubEventOptions } from '../decorator';
import { PubsubEvent } from '../decorator';
import type { AbstractPubsubEvent, PublishOptions } from '../interface';
import { ConfigProvider } from '../provider';
import { toEventName } from '../utils';
import { PubsubManager } from './PubsubManager';
import { PubSubReflector } from './PubSubReflector';

@Injectable()
export class Producer extends PubsubManager implements OnModuleInit {
    /**
     * Set of exchanges where messages are published to
     */
    private readonly exchanges: Set<string> = new Set<string>();

    constructor(private readonly reflector: PubSubReflector) {
        super();
    }

    async onModuleInit(): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }

        this.initConnectionIfRequired();
        this.initChannelIfRequired();
    }

    /**
     * Produce an event.
     */
    async produce(event: AbstractPubsubEvent<any>): Promise<void> {
        if (this.appInTestingMode()) {
            return;
        }
        const metadata: IPubsubEventOptions | undefined = this.reflector.extractEventMetadata(event);
        if (!metadata) {
            throw new Error(`Event should be decorated with "${PubsubEvent.name}"`);
        }
        const { exchange, customRoutingKey }: IPubsubEventOptions = metadata;

        if (!this.exchanges.has(exchange)) {
            await this.channelWrapper.addSetup(async (channel: ConfirmChannel) => channel.assertExchange(exchange, 'topic', this.exchangeOptions()));
            this.exchanges.add(exchange);
        }

        const routingKey: string = customRoutingKey ?? toEventName(event.constructor.name);
        const headers: PublishOptions = { ...this.headers(event.getOptions()), type: routingKey };
        const { payload }: AbstractPubsubEvent<any> = event;

        const message: string = `Event "${routingKey}" to "${exchange}" with ${JSON.stringify({ payload, headers })}`;
        try {
            await this.channelWrapper.publish(exchange, routingKey, payload, headers);
            this.logger().log(`${message} -> PUBLISHED.`);
        } catch (e) {
            if (e instanceof Error) {
                this.logger().error(`${message} -> FAILED TO PUBLISH -> [${e.message}]`, e.stack);
            } else {
                this.logger().error(`${message} -> FAILED TO PUBLISH -> [${JSON.stringify(e)}]`);
            }
        }
    }

    protected headers(extra?: PublishOptions): PublishOptions {
        return {
            ...this.producerConfiguration(),
            ...extra,
        };
    }

    protected producerConfiguration(): PublishOptions {
        return ConfigProvider.producer;
    }
}

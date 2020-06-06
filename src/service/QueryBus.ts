import { Injectable } from '@nestjs/common';
import { QueryBus as NestQueryBus } from '@nestjs/cqrs';

@Injectable()
export class QueryBus extends NestQueryBus {}

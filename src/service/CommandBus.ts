import { Injectable } from '@nestjs/common';
import { CommandBus as NestCommandBus } from '@nestjs/cqrs';

@Injectable()
export class CommandBus extends NestCommandBus {}

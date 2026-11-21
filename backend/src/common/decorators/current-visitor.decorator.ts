import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { describeVisitor, type Visitor } from '../visitor.js';

export const CurrentVisitor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Visitor =>
    describeVisitor(ctx.switchToHttp().getRequest<Request>()),
);

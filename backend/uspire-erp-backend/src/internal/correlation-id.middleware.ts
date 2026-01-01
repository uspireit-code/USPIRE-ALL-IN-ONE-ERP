import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const header = req.header('x-request-id');
    const requestId = header && header.trim() ? header.trim() : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}

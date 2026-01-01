import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const requestId = (req as any).requestId;
      const tenantId = (req as any).tenant?.id;

      this.logger.log(
        JSON.stringify({
          requestId,
          tenantId,
          method: req.method,
          path: req.originalUrl ?? req.url,
          statusCode: res.statusCode,
          durationMs: ms,
        }),
      );
    });

    next();
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const isProd = process.env.NODE_ENV === 'production';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = (req as any)?.requestId;

    if (requestId) {
      res.setHeader('x-request-id', requestId);
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any;

      if (status === HttpStatus.BAD_REQUEST) {
        console.warn('[HTTP 400]', {
          path: req.path,
          method: req.method,
          requestId,
          response,
        });
      }

      if (typeof response === 'object' && response !== null) {
        res.status(status).json({
          ...response,
          requestId,
        });
        return;
      }

      res.status(status).json({
        error: HttpStatus[status] ?? 'ERROR',
        message: response,
        requestId,
      });
      return;
    }

    // Always log unknown/unhandled exceptions server-side for diagnostics.
    // eslint-disable-next-line no-console
    console.error('[HTTP 500]', {
      path: req.path,
      method: req.method,
      requestId,
      message: (exception as any)?.message,
      name: (exception as any)?.name,
      stack: (exception as any)?.stack,
    });

    res.status(status).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: isProd
        ? 'Internal server error'
        : ((exception as any)?.message ?? 'Internal server error'),
      requestId,
    });
  }
}

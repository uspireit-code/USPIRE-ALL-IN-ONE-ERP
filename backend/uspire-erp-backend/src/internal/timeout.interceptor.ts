import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from 'rxjs';
import { isTruthyEnv } from './env.util';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly timeoutMs: number,
    private readonly name: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isTruthyEnv(process.env.TIMEOUTS_ENABLED, true)) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<any>();
    const method = req?.method;

    if (method && method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new GatewayTimeoutException({
                error: 'TIMEOUT',
                message: `${this.name} request exceeded ${this.timeoutMs}ms`,
              }),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

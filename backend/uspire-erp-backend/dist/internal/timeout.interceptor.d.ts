import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class TimeoutInterceptor implements NestInterceptor {
    private readonly timeoutMs;
    private readonly name;
    constructor(timeoutMs: number, name: string);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}

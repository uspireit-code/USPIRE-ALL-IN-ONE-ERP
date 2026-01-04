"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        const isProd = process.env.NODE_ENV === 'production';
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const requestId = req?.requestId;
        if (exception instanceof common_1.HttpException) {
            const response = exception.getResponse();
            if (status === common_1.HttpStatus.BAD_REQUEST) {
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
                error: common_1.HttpStatus[status] ?? 'ERROR',
                message: response,
                requestId,
            });
            return;
        }
        res.status(status).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: isProd
                ? 'Internal server error'
                : (exception?.message ?? 'Internal server error'),
            requestId,
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map
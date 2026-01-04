"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const env_util_1 = require("./env.util");
let TimeoutInterceptor = class TimeoutInterceptor {
    timeoutMs;
    name;
    constructor(timeoutMs, name) {
        this.timeoutMs = timeoutMs;
        this.name = name;
    }
    intercept(context, next) {
        if (!(0, env_util_1.isTruthyEnv)(process.env.TIMEOUTS_ENABLED, true)) {
            return next.handle();
        }
        const req = context.switchToHttp().getRequest();
        const method = req?.method;
        if (method && method !== 'GET') {
            return next.handle();
        }
        return next.handle().pipe((0, rxjs_1.timeout)(this.timeoutMs), (0, rxjs_1.catchError)((err) => {
            if (err instanceof rxjs_1.TimeoutError) {
                return (0, rxjs_1.throwError)(() => new common_1.GatewayTimeoutException({
                    error: 'TIMEOUT',
                    message: `${this.name} request exceeded ${this.timeoutMs}ms`,
                }));
            }
            return (0, rxjs_1.throwError)(() => err);
        }));
    }
};
exports.TimeoutInterceptor = TimeoutInterceptor;
exports.TimeoutInterceptor = TimeoutInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number, String])
], TimeoutInterceptor);
//# sourceMappingURL=timeout.interceptor.js.map
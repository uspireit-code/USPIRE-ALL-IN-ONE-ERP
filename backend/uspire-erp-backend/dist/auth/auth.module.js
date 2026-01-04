"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const env_util_1 = require("../internal/env.util");
function parseDurationToSeconds(value, fallbackSeconds) {
    const trimmed = value.trim();
    if (!trimmed)
        return fallbackSeconds;
    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
    }
    const match = trimmed.match(/^(\d+)([smhd])$/i);
    if (!match)
        return fallbackSeconds;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = unit === 's'
        ? 1
        : unit === 'm'
            ? 60
            : unit === 'h'
                ? 60 * 60
                : 60 * 60 * 24;
    return amount * multiplier;
}
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
                    signOptions: {
                        expiresIn: parseDurationToSeconds((0, env_util_1.getFirstEnv)(['JWT_ACCESS_TTL', 'JWT_ACCESS_EXPIRES_IN']) ?? '15m', 15 * 60),
                    },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService],
        exports: [auth_service_1.AuthService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map
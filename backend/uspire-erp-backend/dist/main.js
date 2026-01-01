"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./internal/http-exception.filter");
const env_validation_1 = require("./internal/env-validation");
const readiness_service_1 = require("./internal/readiness.service");
async function bootstrap() {
    (0, env_validation_1.validateEnvOrExit)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173,http://localhost:5173')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    app.enableCors({
        origin: corsOrigins,
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'x-tenant-id',
            'x-request-id',
        ],
        exposedHeaders: ['Content-Disposition'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
            const details = (errors ?? []).map((e) => {
                const constraints = e.constraints ?? {};
                return {
                    field: e.property,
                    constraints,
                };
            });
            return new common_1.BadRequestException({
                error: 'BAD_REQUEST',
                message: 'VALIDATION_FAILED',
                details,
            });
        },
    }));
    if (process.env.NODE_ENV === 'production') {
        const readiness = app.get(readiness_service_1.ReadinessService);
        const db = await readiness.checkDb();
        const storage = await readiness.checkStorage();
        if (db !== 'ok' || storage !== 'ok') {
            throw new Error(`Startup readiness checks failed: db=${db}, storage=${storage}`);
        }
    }
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map
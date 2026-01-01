import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './internal/http-exception.filter';
import { validateEnvOrExit } from './internal/env-validation';
import { ReadinessService } from './internal/readiness.service';

async function bootstrap() {
  validateEnvOrExit();

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigins = (
    process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173,http://localhost:5173'
  )
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
  app.useGlobalPipes(
    new ValidationPipe({
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

        return new BadRequestException({
          error: 'BAD_REQUEST',
          message: 'VALIDATION_FAILED',
          details,
        });
      },
    }),
  );

  if (process.env.NODE_ENV === 'production') {
    const readiness = app.get(ReadinessService);
    const db = await readiness.checkDb();
    const storage = await readiness.checkStorage();
    if (db !== 'ok' || storage !== 'ok') {
      throw new Error(
        `Startup readiness checks failed: db=${db}, storage=${storage}`,
      );
    }
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

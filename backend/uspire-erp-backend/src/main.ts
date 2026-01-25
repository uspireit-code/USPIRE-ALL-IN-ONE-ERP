import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './internal/http-exception.filter';
import { validateEnvOrExit } from './internal/env-validation';
import { ReadinessService } from './internal/readiness.service';

async function bootstrap() {
  validateEnvOrExit();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  app.enableCors({
    origin: [
      'https://erptest.uspireservices.com',
    ],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    exposedHeaders: ['Content-Disposition'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const fieldErrors = (errors ?? []).flatMap((e) => {
          const constraints = e.constraints ?? {};
          return Object.entries(constraints).map(([code, rawMessage]) => {
            let message = String(rawMessage ?? '').trim();

            if (code === 'isDateString') {
              message = 'Please enter a valid date (YYYY-MM-DD).';
            }

            return {
              field: e.property,
              code,
              message,
            };
          });
        });

        return new BadRequestException({
          error: 'VALIDATION_FAILED',
          message: 'Please fix the highlighted fields and try again.',
          fieldErrors,
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

  const debugRoutes =
    (process.env.DEBUG_ROUTES ?? '').toString().toLowerCase() === 'true';
  if (debugRoutes) {
    await app.init();
    const instance: any = app.getHttpAdapter().getInstance();
    const stack: any[] = instance?._router?.stack ?? [];
    const routes = stack
      .filter((l) => l?.route?.path)
      .map((l) => ({
        path: l.route.path,
        methods: Object.keys(l.route.methods ?? {}).filter((m) => l.route.methods[m]),
      }));

    // eslint-disable-next-line no-console
    console.log('[routes]', routes);
  }

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();

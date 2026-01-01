import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApModule } from './ap/ap.module';
import { ArModule } from './ar/ar.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BankModule } from './bank/bank.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CacheModule } from './cache/cache.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FaModule } from './fa/fa.module';
import { ForecastsModule } from './forecasts/forecasts.module';
import { GlModule } from './gl/gl.module';
import { FinanceModule } from './finance/finance.module';
import { InternalModule } from './internal/internal.module';
import { InternalReadinessModule } from './internal/internal-readiness.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TaxModule } from './tax/tax.module';
import { CorrelationIdMiddleware } from './internal/correlation-id.middleware';
import { RequestLoggerMiddleware } from './internal/request-logger.middleware';
import { TenantMiddleware } from './tenant/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule,
    PrismaModule,
    InternalModule,
    InternalReadinessModule,
    AuthModule,
    RbacModule,
    GlModule,
    FinanceModule,
    ReportsModule,
    TaxModule,
    ApModule,
    ArModule,
    AuditModule,
    DashboardModule,
    BankModule,
    PaymentsModule,
    FaModule,
    BudgetsModule,
    ForecastsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware, TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'ready', method: RequestMethod.ALL },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

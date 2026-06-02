import type { LegalEntity, Tenant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      legalEntity?: Pick<LegalEntity, 'id' | 'tenantId' | 'isActive' | 'effectiveFrom' | 'effectiveTo'>;
      requestId?: string;
      user?: {
        id: string;
        tenantId: string;
        name?: string;
        email: string;
        roles?: string[];
        permissions?: string[];
      };
    }
  }
}

export {};

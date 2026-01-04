import { Tenant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
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

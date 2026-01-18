import { Prisma } from '@prisma/client';

export function translatePrismaError(err: any): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err as any)?.meta?.target;
      if (Array.isArray(target) && target.includes('name')) {
        return 'A supplier with this name already exists.';
      }
      if (Array.isArray(target) && target.includes('invoiceNumber')) {
        return 'A bill/invoice with this number already exists for this supplier.';
      }
      return 'Duplicate record detected.';
    }
  }
  return 'Something went wrong while saving the supplier.';
}

export type ValidationErrorResponse = {
  message: string;
  code: 'VALIDATION_ERROR';
};

function getPrismaTarget(err: unknown): null | string[] {
  const target = (err as any)?.meta?.target;
  if (!Array.isArray(target)) return null;
  return target.map((v) => String(v));
}

function getPrismaFieldName(err: unknown): null | string {
  const field = (err as any)?.meta?.field_name;
  if (!field) return null;
  return String(field);
}

export function isPrismaKnownRequestError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

export function mapImprestValidationError(
  err: unknown,
): null | ValidationErrorResponse {
  if (!isPrismaKnownRequestError(err)) return null;

  if (err.code === 'P2002') {
    const target = getPrismaTarget(err) ?? [];
    const required = ['tenantId', 'name', 'effectiveFrom'];
    const matches = required.every((f) => target.includes(f));
    if (matches) {
      return {
        code: 'VALIDATION_ERROR',
        message:
          'A policy with this name already exists for the selected effective start date. \nPlease change the Effective From date or edit the existing policy.',
      };
    }
  }

  if (err.code === 'P2003') {
    const fieldName = (getPrismaFieldName(err) ?? '').toLowerCase();
    const target = (getPrismaTarget(err) ?? []).map((t) => t.toLowerCase());
    if (fieldName.includes('entity') || target.includes('entityid')) {
      return {
        code: 'VALIDATION_ERROR',
        message:
          'The selected Entity is invalid or not available. Please choose a valid entity.',
      };
    }
  }

  return null;
}

export function mapGenericPrismaValidationError(
  err: unknown,
  message: string,
): null | ValidationErrorResponse {
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { code: 'VALIDATION_ERROR', message };
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return { code: 'VALIDATION_ERROR', message };
  }

  return null;
}

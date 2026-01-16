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

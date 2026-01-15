import { Prisma } from '@prisma/client';

export function translatePrismaError(err: any): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err as any)?.meta?.target;
      if (Array.isArray(target) && target.includes('name')) {
        return 'A supplier with this name already exists.';
      }
      return 'Duplicate record detected.';
    }
  }
  return 'Something went wrong while saving the supplier.';
}

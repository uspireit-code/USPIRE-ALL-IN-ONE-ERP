import { BadRequestException } from '@nestjs/common';

const AR_CONTROL_INVALID_MESSAGE =
  'AR control account is not configured or is invalid. Please check Finance Settings.';

export async function resolveArControlAccount(
  prisma: any,
  tenantId: string,
): Promise<{ id: string; code: string; name: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { arControlAccountId: true },
  });

  const arControlAccountId = String(tenant?.arControlAccountId ?? '').trim();
  if (!arControlAccountId) {
    throw new BadRequestException(AR_CONTROL_INVALID_MESSAGE);
  }

  const arAccount = await prisma.account.findFirst({
    where: {
      tenantId,
      id: arControlAccountId,
      isActive: true,
      type: 'ASSET',
      normalBalance: 'DEBIT',
    },
    select: { id: true, code: true, name: true },
  });

  if (!arAccount) {
    throw new BadRequestException(AR_CONTROL_INVALID_MESSAGE);
  }

  return arAccount;
}

const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.customerCreditNote.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        isTaxable: true,
        totalAmount: true,
      },
    });

    console.log('ok', { count: rows.length, sample: rows[0] ?? null });
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error('fail', e);
  process.exit(1);
});

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "bankStatementId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "statementLineId" TEXT NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL,
    "reconciledBy" TEXT NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_idx" ON "BankStatement"("tenantId");

-- CreateIndex
CREATE INDEX "BankStatement_bankAccountId_idx" ON "BankStatement"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_tenantId_bankAccountId_statementDate_key" ON "BankStatement"("tenantId", "bankAccountId", "statementDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_bankStatementId_idx" ON "BankStatementLine"("bankStatementId");

-- CreateIndex
CREATE INDEX "BankStatementLine_transactionDate_idx" ON "BankStatementLine"("transactionDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_isReconciled_idx" ON "BankStatementLine"("isReconciled");

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_idx" ON "BankReconciliation"("tenantId");

-- CreateIndex
CREATE INDEX "BankReconciliation_bankAccountId_idx" ON "BankReconciliation"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_statementLineId_key" ON "BankReconciliation"("statementLineId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_paymentId_key" ON "BankReconciliation"("paymentId");

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_bankStatementId_fkey" FOREIGN KEY ("bankStatementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "BankStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

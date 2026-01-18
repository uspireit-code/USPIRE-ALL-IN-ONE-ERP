-- CreateEnum
CREATE TYPE "PaymentProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "PaymentProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalNumber" TEXT NOT NULL,
    "proposalDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProposalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "proposedPayAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProposalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProposal_tenantId_idx" ON "PaymentProposal"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentProposal_tenantId_status_idx" ON "PaymentProposal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentProposal_tenantId_proposalDate_idx" ON "PaymentProposal"("tenantId", "proposalDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProposal_tenantId_proposalNumber_key" ON "PaymentProposal"("tenantId", "proposalNumber");

-- CreateIndex
CREATE INDEX "PaymentProposalLine_tenantId_idx" ON "PaymentProposalLine"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentProposalLine_proposalId_idx" ON "PaymentProposalLine"("proposalId");

-- CreateIndex
CREATE INDEX "PaymentProposalLine_supplierId_idx" ON "PaymentProposalLine"("supplierId");

-- CreateIndex
CREATE INDEX "PaymentProposalLine_invoiceId_idx" ON "PaymentProposalLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProposalLine_proposalId_invoiceId_key" ON "PaymentProposalLine"("proposalId", "invoiceId");

-- AddForeignKey
ALTER TABLE "PaymentProposal" ADD CONSTRAINT "PaymentProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposal" ADD CONSTRAINT "PaymentProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposal" ADD CONSTRAINT "PaymentProposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposalLine" ADD CONSTRAINT "PaymentProposalLine_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "PaymentProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposalLine" ADD CONSTRAINT "PaymentProposalLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposalLine" ADD CONSTRAINT "PaymentProposalLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProposalLine" ADD CONSTRAINT "PaymentProposalLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

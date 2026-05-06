-- CreateEnum
CREATE TYPE "IfrsStatement" AS ENUM ('BS', 'PL', 'CF');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "ifrsNodeId" TEXT;

-- CreateTable
CREATE TABLE "IfrsNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "statement" "IfrsStatement" NOT NULL,
    "parentId" TEXT,
    "level" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "IfrsNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IfrsNode_tenantId_idx" ON "IfrsNode"("tenantId");

-- CreateIndex
CREATE INDEX "IfrsNode_tenantId_statement_idx" ON "IfrsNode"("tenantId", "statement");

-- CreateIndex
CREATE INDEX "IfrsNode_parentId_idx" ON "IfrsNode"("parentId");

-- CreateIndex
CREATE INDEX "IfrsNode_createdById_idx" ON "IfrsNode"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "IfrsNode_tenantId_statement_name_key" ON "IfrsNode"("tenantId", "statement", "name");

-- CreateIndex
CREATE UNIQUE INDEX "IfrsNode_tenantId_code_key" ON "IfrsNode"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Account_tenantId_ifrsNodeId_idx" ON "Account"("tenantId", "ifrsNodeId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ifrsNodeId_fkey" FOREIGN KEY ("ifrsNodeId") REFERENCES "IfrsNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfrsNode" ADD CONSTRAINT "IfrsNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfrsNode" ADD CONSTRAINT "IfrsNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IfrsNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfrsNode" ADD CONSTRAINT "IfrsNode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_startDate_endDate_idx" ON "AccountingPeriod"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_eventType_createdAt_idx" ON "AuditEvent"("tenantId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_accountId_idx" ON "BudgetLine"("budgetId", "accountId");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_accountId_month_idx" ON "ForecastLine"("forecastVersionId", "accountId", "month");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_journalDate_idx" ON "JournalEntry"("tenantId", "status", "journalDate");

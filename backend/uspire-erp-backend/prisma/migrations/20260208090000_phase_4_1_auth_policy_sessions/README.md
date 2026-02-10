PHASE 4.1 — AUTH POLICY + SESSION MANAGEMENT MIGRATION

This migration was generated using:

npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://postgres:UspirePostgres2026%21@localhost:5433/uspire_erp_shadow?schema=public \
  --script

Then saved into tmp_migration.sql and moved here as migration.sql.

Purpose:
- Add User password policy fields (expiry + mustChangePassword)
- Add UserSession table (concurrent session enforcement)
- Add AuditEventType enum values required for Phase 4.1

Generated non-interactively for safe review.

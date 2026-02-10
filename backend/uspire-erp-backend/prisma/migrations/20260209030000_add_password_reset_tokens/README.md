PHASE 4.1B — PASSWORD RESET TOKENS + PASSWORD COMPLEXITY

Purpose:
- Add PasswordResetToken table for secure forgot/reset password flows
- Add AuditEventType values for PASSWORD_RESET_SUCCESS / PASSWORD_RESET_FAILED

Notes:
- This migration was created manually due to non-interactive Prisma diff execution timing out in the IDE runner.
- Token values are stored only as bcrypt hashes (tokenHash). Raw tokens are never persisted.
- Tokens are intended to expire after 15 minutes and be single-use (consumedAt).

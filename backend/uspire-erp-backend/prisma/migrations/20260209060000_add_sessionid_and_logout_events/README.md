Manual migration to align UserSession with session management (adds sessionId column + indexes + cascade FKs) and extend AuditEventType with SESSION_LOGIN_BLOCKED and AUTH_LOGOUT.

Applied using `npx prisma migrate deploy`.

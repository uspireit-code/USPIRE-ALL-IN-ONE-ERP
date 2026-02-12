-- Grant required system config permissions to SUPERADMIN role(s) so organisation branding updates are allowed.

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" IN ('SYSTEM_CONFIG_UPDATE', 'SYSTEM_CONFIG_VIEW')
WHERE r."name" = 'SUPERADMIN'
ON CONFLICT DO NOTHING;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%BANK_RECON_MATCHING_ENGINE%'
ORDER BY migration_name;

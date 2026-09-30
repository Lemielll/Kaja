# Database Migrations

Migration files are numbered and applied in order. Each migration is idempotent
(safe to run multiple times using `IF NOT EXISTS` or similar guards).

## Running migrations

Against local database:
```bash
psql $DATABASE_URL -f service/db/migrations/001_add_version_columns.sql
```

Against deployed database (requires manual approval):
```bash
# Get DATABASE_URL from Render dashboard
# IMPORTANT: Backup database before running migrations in production
psql "<production-url>" -f service/db/migrations/001_add_version_columns.sql
```

## Migration log

| # | Date | Description | Status |
|---|---|---|---|
| 001 | 2026-09-30 | Add version columns for optimistic locking | Ready for deployment |

## Schema evolution rules

1. Never edit migrations that have already run in deployment
2. Always create a new migration file for schema changes
3. Migrations must be idempotent (IF NOT EXISTS, IF NOT NULL, etc.)
4. Seed data is separate from migrations (see `../seed.sql`)
5. Test migration on empty database AND on database with existing data

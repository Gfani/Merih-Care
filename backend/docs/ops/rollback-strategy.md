# Merihcare Deployment Rollback Strategy

## 1. Application Container Rollback
If a newly deployed build introduces unexpected runtime regressions or fails health checks:

```bash
# 1. Rollback container images to previous release tag
docker compose -f docker-compose.yml down
git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
docker compose -f docker-compose.yml up -d --build

# 2. Confirm traffic restoration
curl -f https://api.merihcare.et/api/v1/health
```

## 2. Database Migration Rollback
If a database schema migration must be reverted:

```bash
# Revert latest migration
docker compose exec backend npm run migration:revert
```

## 3. Disaster Database Point-in-Time Restore
If database corruption occurs:

```bash
# Restore latest automated backup snapshot from /app/backups
docker compose exec -T postgres psql -U merihcare_prod_user -d merihcare_production < /app/backups/merihcare_backup_latest.sql
```

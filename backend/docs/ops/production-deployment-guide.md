# Merihcare Production Deployment Guide

## 1. Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Domain DNS pointed to Server IP:
  - `api.merihcare.et` -> Backend API
  - `admin.merihcare.et` -> Admin Portal
  - `storage.merihcare.et` -> S3/MinIO Object Storage
- SSL/TLS Certificates generated via Certbot / Let's Encrypt

## 2. Secrets Management
Populate `/etc/merihcare/.env.production` (never commit directly to version control):
```bash
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=merihcare_prod_user
DB_PASSWORD=<STRONG_RANDOM_PASSWORD>
DB_DATABASE=merihcare_production
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<STRONG_REDIS_PASSWORD>
JWT_SECRET=<STRONG_JWT_SIGNING_SECRET>
ENCRYPTION_KEY=<32_BYTE_HEX_AES_KEY>
TELEBIRR_APP_ID=<PRODUCTION_APP_ID>
TELEBIRR_APP_KEY=<PRODUCTION_APP_KEY>
CBE_BIRR_CLIENT_ID=<PRODUCTION_CLIENT_ID>
```

## 3. Deployment Steps
```bash
# 1. Pull latest code
git pull origin main

# 2. Build and run containers
docker compose -f docker-compose.yml up -d --build

# 3. Verify health status
docker compose ps
curl -f https://api.merihcare.et/api/v1/health
```

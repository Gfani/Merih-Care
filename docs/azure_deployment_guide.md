# Merihcare — Microsoft Azure Production Deployment Guide

This comprehensive guide covers deploying the entire **Merihcare** healthcare platform to **Microsoft Azure**.

---

## Architecture Overview

```mermaid
graph TB
    subgraph Clients["Clients & Edge Tier"]
        Mobile["Flutter Mobile App<br/>(Patient & Clinician)"]
        AdminBrowser["Admin Web Portal<br/>(Clinical Verifier / Admin)"]
        AzureSWA["Azure Static Web Apps<br/>(Global CDN / Edge Ingress)"]
    end

    subgraph AzureEnv["Azure Container Apps Environment (VNet)"]
        BackendApp["Azure Container App<br/>(NestJS API & WebSockets)<br/>app-merihcare-prod-backend"]
        VolumeMount["Azure Files Mount<br/>(/app/uploads)<br/>stmerihcareprod"]
    end

    subgraph ManagedData["Azure Managed Data Tier"]
        Postgres["Azure Database for PostgreSQL<br/>Flexible Server 15 (SSL)<br/>psql-merihcare-prod"]
        Redis["Azure Cache for Redis<br/>(Session, Cache & PubSub)"]
        ACR["Azure Container Registry (ACR)<br/>crimerihcareprod"]
    end

    AdminBrowser -->|HTTPS| AzureSWA
    AzureSWA -->|REST / CORS| BackendApp
    Mobile -->|REST API / WebSockets| BackendApp
    BackendApp -->|SSL (Port 5432)| Postgres
    BackendApp -->|TLS (Port 6380)| Redis
    BackendApp -->|Read / Write| VolumeMount
    ACR -.->|Deploy Container Image| BackendApp
```

---

## Method 1: 1-Click Cloud Shell Deployment (Recommended)

You do **not** need Docker or the Azure CLI installed on your local computer. You can deploy directly from your web browser using **Azure Cloud Shell**.

### Step 1: Open Azure Cloud Shell
1. Go to [https://shell.azure.com](https://shell.azure.com) and sign in with your Azure account.
2. Ensure **Bash** environment is selected in the top-left dropdown.

### Step 2: Clone Repository & Run Deployment
Paste the following command in Azure Cloud Shell:

```bash
git clone https://github.com/Gfani/Merih-Care.git
cd Merih-Care/infra/azure
chmod +x deploy.sh
./deploy.sh
```

### What `deploy.sh` Automatically Provisions:
- **Resource Group**: `rg-merihcare-prod` in `eastus` (or chosen region).
- **Azure Container Registry (ACR)**: Private enterprise registry for your Docker images.
- **Azure Database for PostgreSQL Flexible Server**: PostgreSQL 15 with automated daily backups, high availability, and SSL enforced.
- **Azure Storage Account & Azure Files**: Mounted to `/app/uploads` so uploaded doctor credentials, CVs, and medical licenses persist across container restarts.
- **Azure Container Apps Managed Environment**: Serverless container cluster with Log Analytics workspace.
- **Azure Container App (Backend)**: Built directly in Azure Cloud ACR (`az acr build`), running NestJS with auto-scaling (1 to 5 replicas) and WebSocket support enabled.
- **Azure Static Web App (Admin Portal)**: Built and deployed with zero-config edge CDN distribution and free SSL.

### Output
At the conclusion of the script, your live production URLs will be displayed:
```text
======================================================================
 MERIHCARE AZURE PRODUCTION DEPLOYMENT COMPLETE!
======================================================================
  Backend API URL:      https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1
  Swagger Docs URL:     https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/docs
  Health Check:         https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1/health
  Admin Web Portal:     https://swa-merihcare-prod-admin.<region>.azurestaticapps.net
  PostgreSQL Host:      psql-merihcare-prod-xxxxxx.postgres.database.azure.com
  Database User:        merihcare_admin
  Database Name:        merihcare_db
======================================================================
```

---

## Method 2: Cost-Optimized Single Azure VM (Docker Compose)

If you prefer running the entire stack on a single virtual machine (lowest monthly cost, ~$25 - $35/month):

1. Open Azure Cloud Shell or your terminal with Azure CLI:
```bash
cd merihcare/infra/azure
chmod +x azure-vm-deploy.sh
./azure-vm-deploy.sh
```

2. The script provisions:
   - Ubuntu 22.04 LTS VM (`Standard_B2s`, 2 vCPU, 4GB RAM).
   - Automatically installs Docker CE and Docker Compose.
   - Configures UFW firewall rules opening ports 22, 80, and 443.

3. SSH into the VM:
```bash
ssh azureuser@<VM_PUBLIC_IP>
```

4. Clone and launch with Docker Compose:
```bash
git clone https://github.com/Gfani/Merih-Care.git
cd Merih-Care
cp .env.production.example .env.production
# Edit .env.production with your strong secrets
docker compose up -d
```

---

## Method 3: Automated CI/CD via GitHub Actions

To have GitHub automatically deploy to Azure whenever you push to the `main` branch:

### Step 1: Create Azure Service Principal for GitHub
In Azure Cloud Shell or local terminal:
```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "sp-merihcare-github-actions" \
  --role "contributor" \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-merihcare-prod" \
  --sdk-auth
```

Copy the JSON output.

### Step 2: Add GitHub Repository Secrets
Go to your GitHub repository: **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | The JSON output from the `az ad sp create-for-rbac` command above |
| `ACR_NAME` | Name of your Azure Container Registry (e.g., `crimerihcareprodxxxxxx`) |
| `ACR_LOGIN_SERVER` | Login server of your ACR (e.g., `crimerihcareprodxxxxxx.azurecr.io`) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Azure Static Web App (found in Azure Portal -> Overview -> Manage deployment token) |
| `AZURE_BACKEND_API_URL` | Your live backend API URL (e.g., `https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1`) |

### Step 3: Trigger Pipeline
Push your changes to the `main` branch:
```bash
git push origin main
```
GitHub Actions will run tests, build the backend container, push it to ACR, update Azure Container Apps, build the Admin Web portal, and deploy it to Azure Static Web Apps.

---

## Connecting the Flutter Mobile App to Azure

The Flutter mobile app supports compile-time environment variables:

### Building Android Release APK
Run this command on your machine to build a release APK pointing to your Azure backend:
```bash
cd merihcare/mobile

flutter build apk --release \
  --dart-define=API_URL=https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1 \
  --dart-define=REALTIME_URL=https://app-merihcare-prod-backend.<region>.azurecontainerapps.io
```

The compiled APK will be at:
`mobile/build/app/outputs/flutter-apk/app-release.apk`

### Building Android App Bundle (AAB for Google Play Store)
```bash
flutter build appbundle --release \
  --dart-define=API_URL=https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1 \
  --dart-define=REALTIME_URL=https://app-merihcare-prod-backend.<region>.azurecontainerapps.io
```

---

## Setting Up Custom Domains & Free SSL Certificates

### Backend Custom Domain (`api.merihcare.et`)
1. In the **Azure Portal**, navigate to your Container App: `app-merihcare-prod-backend`.
2. Under **Settings**, select **Custom domains**.
3. Click **+ Add custom domain**.
4. Enter `api.merihcare.et`.
5. Add the provided DNS `CNAME` record in your domain registrar (pointing `api.merihcare.et` to your Container App FQDN).
6. Click **Validate** -> **Add**.
7. Under Certificate, select **Managed certificate** (Azure provides and auto-renews free SSL certificates).

### Admin Portal Custom Domain (`admin.merihcare.et`)
1. In the **Azure Portal**, navigate to your Static Web App: `swa-merihcare-prod-admin`.
2. Under **Settings**, select **Custom domains**.
3. Click **+ Add**. Enter `admin.merihcare.et`.
4. Add the provided `CNAME` record in your DNS provider.
5. Azure automatically issues a free SSL certificate.

---

## Monitoring, Live Logs & Troubleshooting

### View Live Backend Logs in Azure
```bash
az containerapp logs show \
  --name app-merihcare-prod-backend \
  --resource-group rg-merihcare-prod \
  --follow
```

### Check Backend Health
```bash
curl -i https://app-merihcare-prod-backend.<region>.azurecontainerapps.io/api/v1/health
```

### Run Database Migrations in Azure Container App
If needed, execute migrations directly inside the running container:
```bash
az containerapp exec \
  --name app-merihcare-prod-backend \
  --resource-group rg-merihcare-prod \
  --command "npm run migration:run"
```

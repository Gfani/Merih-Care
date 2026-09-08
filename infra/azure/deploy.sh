#!/usr/bin/env bash
# ==============================================================================
# Merihcare - 1-Click Production Deployment to Microsoft Azure
# Can be run directly in Azure Cloud Shell (https://shell.azure.com) or local bash
# ==============================================================================

set -euo pipefail

# Configuration defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-merihcare-prod}"
LOCATION="${LOCATION:-eastus}"
ENV_NAME="${ENV_NAME:-merihcare-prod}"
DB_USER="merihcare_admin"

echo "======================================================================"
echo " Starting Merihcare Azure Deployment: ${ENV_NAME} in ${LOCATION}"
echo "======================================================================"

# 1. Verify Azure CLI Authentication
if ! az account show > /dev/null 2>&1; then
  echo "[ERROR] You are not logged into Azure CLI. Please run 'az login' first."
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "Active Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"

# 2. Create Resource Group
echo "[STEP 1/6] Creating Azure Resource Group: ${RESOURCE_GROUP}..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" -o table

# 3. Generate Secure Passwords if not provided
if [ -z "${DB_PASSWORD:-}" ]; then
  DB_PASSWORD="Mh$(openssl rand -hex 12)!Aa1"
  echo "Generated secure PostgreSQL password."
fi

if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "Generated secure 64-character JWT secret."
fi

# 4. Deploy Infrastructure via Bicep
echo "[STEP 2/6] Deploying Azure Infrastructure (ACR, PostgreSQL, Container Apps, Storage, Static Web App)..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "${RESOURCE_GROUP}" \
  --template-file "./main.bicep" \
  --parameters \
    environmentName="${ENV_NAME}" \
    dbAdminUser="${DB_USER}" \
    dbAdminPassword="${DB_PASSWORD}" \
    jwtSecret="${JWT_SECRET}" \
  --query properties.outputs -o json)

ACR_LOGIN_SERVER=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .acrLoginServer.value)
ACR_NAME=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .acrName.value)
POSTGRES_FQDN=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .postgresServerFqdn.value)
BACKEND_APP_URL=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .backendUrl.value)
ADMIN_WEB_URL=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .adminWebUrl.value)
SWA_API_KEY=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r .staticWebAppApiKey.value)

echo "Infrastructure deployed successfully!"
echo "  - ACR: ${ACR_LOGIN_SERVER}"
echo "  - PostgreSQL: ${POSTGRES_FQDN}"
echo "  - Backend Container App URL: ${BACKEND_APP_URL}"
echo "  - Admin Web App URL: ${ADMIN_WEB_URL}"

# 5. Build and Push Backend Container directly in ACR (No local Docker required!)
echo "[STEP 3/6] Building Backend Container Image in Azure Cloud ACR..."
BACKEND_IMAGE="${ACR_LOGIN_SERVER}/merihcare-backend:latest"
az acr build \
  --registry "${ACR_NAME}" \
  --image "merihcare-backend:latest" \
  ../../backend

# 6. Update Container App to use the built image
echo "[STEP 4/6] Updating Container App to run ${BACKEND_IMAGE}..."
BACKEND_APP_NAME="app-${ENV_NAME}-backend"
az containerapp update \
  --name "${BACKEND_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${BACKEND_IMAGE}" \
  -o table

# 7. Build and Deploy Admin Web
echo "[STEP 5/6] Building and Deploying Admin Web Portal..."
pushd ../../admin-web > /dev/null
export VITE_API_URL="${BACKEND_APP_URL}/api/v1"
npm install
npm run build
popd > /dev/null

# Deploy static assets via Azure Static Web Apps CLI (or az staticwebapp)
if command -v swa > /dev/null 2>&1; then
  swa deploy ../../admin-web/dist --deployment-token "${SWA_API_KEY}" --env production
else
  npx -y @azure/static-web-apps-cli deploy ../../admin-web/dist --deployment-token "${SWA_API_KEY}" --env production
fi

# 8. Summary of Live Deployment
echo "======================================================================"
echo " MERIHCARE AZURE PRODUCTION DEPLOYMENT COMPLETE!"
echo "======================================================================"
echo "  Backend API URL:      ${BACKEND_APP_URL}/api/v1"
echo "  Swagger Docs URL:     ${BACKEND_APP_URL}/api/docs"
echo "  Health Check:         ${BACKEND_APP_URL}/api/v1/health"
echo "  Admin Web Portal:     ${ADMIN_WEB_URL}"
echo "  PostgreSQL Host:      ${POSTGRES_FQDN}"
echo "  Database User:        ${DB_USER}"
echo "  Database Name:        merihcare_db"
echo "======================================================================"
echo "Save these credentials in a secure password manager."

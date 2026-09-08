<#
.SYNOPSIS
  Merihcare - 1-Click Production Deployment to Microsoft Azure (PowerShell)
.DESCRIPTION
  Provisions Azure Resource Group, Bicep infrastructure, cloud-builds backend container image,
  updates Azure Container App, and deploys Admin Web to Azure Static Web Apps.
#>

param(
  [string]$ResourceGroup = "rg-merihcare-prod",
  [string]$Location = "eastus",
  [string]$EnvName = "merihcare-prod",
  [string]$DbUser = "merihcare_admin",
  [string]$DbPassword = "",
  [string]$JwtSecret = ""
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Starting Merihcare Azure Deployment: $EnvName in $Location" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Check Azure Login
try {
  $account = az account show -o json | ConvertFrom-Json
  Write-Host "Active Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
} catch {
  Write-Error "You are not logged into Azure CLI. Please run 'az login' first."
}

# 2. Generate Secrets if not supplied
if (-not $DbPassword) {
  $bytes = New-Object byte[] 12
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $DbPassword = "Mh" + [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower() + "!Aa1"
  Write-Host "Generated secure PostgreSQL password." -ForegroundColor Yellow
}

if (-not $JwtSecret) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $JwtSecret = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
  Write-Host "Generated secure 64-character JWT secret." -ForegroundColor Yellow
}

# 3. Create Resource Group
Write-Host "[STEP 1/6] Creating Azure Resource Group: $ResourceGroup..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location -o table

# 4. Deploy Infrastructure via Bicep
Write-Host "[STEP 2/6] Deploying Azure Infrastructure via Bicep..." -ForegroundColor Cyan
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bicepPath = Join-Path $scriptDir "main.bicep"

$deployResult = az deployment group create `
  --resource-group $ResourceGroup `
  --template-file $bicepPath `
  --parameters `
    environmentName=$EnvName `
    dbAdminUser=$DbUser `
    dbAdminPassword=$DbPassword `
    jwtSecret=$JwtSecret `
  --query properties.outputs -o json | ConvertFrom-Json

$acrLoginServer = $deployResult.acrLoginServer.value
$acrName = $deployResult.acrName.value
$postgresFqdn = $deployResult.postgresServerFqdn.value
$backendAppUrl = $deployResult.backendUrl.value
$adminWebUrl = $deployResult.adminWebUrl.value
$swaApiKey = $deployResult.staticWebAppApiKey.value

Write-Host "Infrastructure deployed successfully!" -ForegroundColor Green
Write-Host "  - ACR: $acrLoginServer"
Write-Host "  - PostgreSQL: $postgresFqdn"
Write-Host "  - Backend Container App URL: $backendAppUrl"
Write-Host "  - Admin Web URL: $adminWebUrl"

# 5. Build and Push Backend Container directly in Azure ACR
Write-Host "[STEP 3/6] Building Backend Container in Azure Cloud ACR (No local Docker needed)..." -ForegroundColor Cyan
$backendDir = Resolve-Path (Join-Path $scriptDir "..\..\backend")
az acr build --registry $acrName --image "merihcare-backend:latest" $backendDir

# 6. Update Container App to run the newly built image
Write-Host "[STEP 4/6] Updating Container App to run image..." -ForegroundColor Cyan
$backendAppName = "app-$EnvName-backend"
$backendImage = "$acrLoginServer/merihcare-backend:latest"
az containerapp update --name $backendAppName --resource-group $ResourceGroup --image $backendImage -o table

# 7. Build and Deploy Admin Web to Azure Static Web Apps
Write-Host "[STEP 5/6] Building Admin Web Portal..." -ForegroundColor Cyan
$adminWebDir = Resolve-Path (Join-Path $scriptDir "..\..\admin-web")
$env:VITE_API_URL = "$backendAppUrl/api/v1"

Push-Location $adminWebDir
npm install
npm run build
Pop-Location

Write-Host "[STEP 6/6] Deploying Admin Web to Azure Static Web Apps..." -ForegroundColor Cyan
npx -y @azure/static-web-apps-cli deploy "$adminWebDir\dist" --deployment-token $swaApiKey --env production

Write-Host "======================================================================" -ForegroundColor Green
Write-Host " MERIHCARE AZURE PRODUCTION DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  Backend API URL:      $backendAppUrl/api/v1" -ForegroundColor Yellow
Write-Host "  Swagger Docs URL:     $backendAppUrl/api/docs" -ForegroundColor Yellow
Write-Host "  Health Check:         $backendAppUrl/api/v1/health" -ForegroundColor Yellow
Write-Host "  Admin Web Portal:     $adminWebUrl" -ForegroundColor Yellow
Write-Host "  PostgreSQL Host:      $postgresFqdn" -ForegroundColor Yellow
Write-Host "  Database User:        $DbUser" -ForegroundColor Yellow
Write-Host "  Database Name:        merihcare_db" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green

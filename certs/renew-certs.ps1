<#
.SYNOPSIS
    Automated TLS Certificate Renewal Hook for Merihcare (PowerShell)
.DESCRIPTION
    Ensures Certbot or Azure Key Vault auto-renewal hooks export certificates to
    certs/merihcare.crt and certs/merihcare.key and reloads Nginx.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$OutputCrt = Join-Path $ScriptDir "merihcare.crt"
$OutputKey = Join-Path $ScriptDir "merihcare.key"
$PrimaryDomain = "admin.merihcare.et"

Write-Host "[TLS RENEW] Checking Merihcare TLS Certificate status..." -ForegroundColor Cyan

# 1. Azure Key Vault hook
if ($env:AZURE_KEYVAULT_NAME -and $env:AZURE_CERT_NAME -and (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "[TLS RENEW] Fetching certificate from Azure Key Vault: $($env:AZURE_KEYVAULT_NAME)..." -ForegroundColor Yellow
    $bundleFile = Join-Path $ScriptDir "bundle.pem"
    az keyvault secret download --vault-name $env:AZURE_KEYVAULT_NAME --name $env:AZURE_CERT_NAME --file $bundleFile
    if (Test-Path $bundleFile) {
        openssl x509 -in $bundleFile -out $OutputCrt
        openssl rsa -in $bundleFile -out $OutputKey
        Remove-Item $bundleFile -Force
        Write-Host "[TLS RENEW] Azure Key Vault certificate updated." -ForegroundColor Green
    }
}
# 2. Certbot hook
elseif (Get-Command certbot -ErrorAction SilentlyContinue) {
    Write-Host "[TLS RENEW] Triggering Certbot renewal check..." -ForegroundColor Yellow
    certbot renew --quiet
    $liveDir = "C:\Certbot\live\$PrimaryDomain"
    if (Test-Path "$liveDir\fullchain.pem") {
        Copy-Item "$liveDir\fullchain.pem" -Destination $OutputCrt -Force
        Copy-Item "$liveDir\privkey.pem" -Destination $OutputKey -Force
        Write-Host "[TLS RENEW] Certbot certificates synced to $OutputCrt." -ForegroundColor Green
    }
}
# 3. Fallback Self-Signed certificate for development
else {
    if (-not (Test-Path $OutputCrt) -or -not (Test-Path $OutputKey)) {
        Write-Host "[TLS RENEW] Generating local development TLS certificates..." -ForegroundColor Yellow
        if (Get-Command openssl -ErrorAction SilentlyContinue) {
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $OutputKey -out $OutputCrt -subj "/CN=$PrimaryDomain"
            Write-Host "[TLS RENEW] Self-signed certificates generated." -ForegroundColor Green
        }
    }
}

# 4. Reload Nginx if Docker container is active
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $running = docker ps --format '{{.Names}}' | Select-String "merihcare-nginx"
    if ($running) {
        Write-Host "[TLS RENEW] Reloading Nginx container..." -ForegroundColor Cyan
        docker exec merihcare-nginx nginx -s reload
    }
}

Write-Host "[TLS RENEW] Certificate check complete." -ForegroundColor Green

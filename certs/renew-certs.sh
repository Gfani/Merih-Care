#!/usr/bin/env bash
# ==============================================================================
# Merihcare Automated TLS Certificate Renewal Hook
# Automates Let's Encrypt (Certbot) & Azure Key Vault certificate synchronization
# into Nginx: /etc/nginx/certs/merihcare.crt & merihcare.key
# ==============================================================================

set -euo pipefail

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAINS=("admin.merihcare.et" "api.merihcare.et" "app.merihcare.et" "merihcare.live")
PRIMARY_DOMAIN="${DOMAINS[0]}"
OUTPUT_CRT="${CERTS_DIR}/merihcare.crt"
OUTPUT_KEY="${CERTS_DIR}/merihcare.key"
WEBROOT_DIR="${CERTS_DIR}/../certbot/www"

echo "[TLS RENEW] Starting TLS certificate renewal check for Merihcare..."
mkdir -p "${CERTS_DIR}" "${WEBROOT_DIR}"

# 1. Check for Azure Key Vault Managed Certificate Mode
if command -v az &>/dev/null && [ -n "${AZURE_KEYVAULT_NAME:-}" ] && [ -n "${AZURE_CERT_NAME:-}" ]; then
    echo "[TLS RENEW] Downloading active TLS certificate from Azure Key Vault: ${AZURE_KEYVAULT_NAME}/${AZURE_CERT_NAME}..."
    az keyvault secret download \
        --vault-name "${AZURE_KEYVAULT_NAME}" \
        --name "${AZURE_CERT_NAME}" \
        --file "${CERTS_DIR}/bundle.pem"

    openssl x509 -in "${CERTS_DIR}/bundle.pem" -out "${OUTPUT_CRT}"
    openssl rsa -in "${CERTS_DIR}/bundle.pem" -out "${OUTPUT_KEY}"
    rm -f "${CERTS_DIR}/bundle.pem"
    echo "[TLS RENEW] Azure Key Vault certificate successfully exported."

# 2. Check for Certbot Automated Renewal Mode
elif command -v certbot &>/dev/null; then
    echo "[TLS RENEW] Executing Certbot automated certificate renewal..."
    certbot renew --webroot -w "${WEBROOT_DIR}" --quiet || true

    LIVE_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
    if [ -d "${LIVE_DIR}" ] && [ -f "${LIVE_DIR}/fullchain.pem" ]; then
        echo "[TLS RENEW] Linking renewed Let's Encrypt certificates to Nginx bundle..."
        cp -L "${LIVE_DIR}/fullchain.pem" "${OUTPUT_CRT}"
        cp -L "${LIVE_DIR}/privkey.pem" "${OUTPUT_KEY}"
        chmod 600 "${OUTPUT_KEY}"
        echo "[TLS RENEW] Certbot certificates updated."
    else
        echo "[TLS RENEW] No live Certbot directory found for ${PRIMARY_DOMAIN}. Preserving existing certificates."
    fi

# 3. Fallback: Development Self-Signed Generator
else
    echo "[TLS RENEW] Neither Certbot nor Azure CLI detected."
    if [ ! -f "${OUTPUT_CRT}" ] || [ ! -f "${OUTPUT_KEY}" ]; then
        echo "[TLS RENEW] Generating initial fallback TLS certificate for development..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "${OUTPUT_KEY}" \
            -out "${OUTPUT_CRT}" \
            -subj "/C=ET/ST=Addis Ababa/L=Addis Ababa/O=Merihcare/CN=${PRIMARY_DOMAIN}"
    fi
fi

# 4. Gracefully reload Nginx if running
if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "merihcare-nginx"; then
        echo "[TLS RENEW] Reloading Nginx container configurations..."
        docker exec merihcare-nginx nginx -s reload || true
        echo "[TLS RENEW] Nginx reloaded successfully."
    fi
elif pgrep nginx &>/dev/null; then
    echo "[TLS RENEW] Reloading local Nginx daemon..."
    nginx -s reload || true
fi

echo "[TLS RENEW] Certificate renewal process completed successfully."

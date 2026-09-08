#!/usr/bin/env bash
# ==============================================================================
# Merihcare - Option 2: Azure VM with Docker Compose & Nginx TLS
# Provisions an Ubuntu 22.04 LTS VM on Azure and launches the docker-compose stack
# ==============================================================================

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-merihcare-vm}"
LOCATION="${LOCATION:-eastus}"
VM_NAME="${VM_NAME:-vm-merihcare-prod}"
VM_SIZE="${VM_SIZE:-Standard_B2s}" # 2 vCPU, 4GB RAM (~$30/month)
ADMIN_USERNAME="${ADMIN_USERNAME:-azureuser}"

echo "======================================================================"
echo " Deploying Merihcare to Azure Virtual Machine: ${VM_NAME}"
echo "======================================================================"

# 1. Create Resource Group
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" -o table

# 2. Generate cloud-init configuration script for VM setup
CLOUD_INIT_FILE=$(mktemp)
cat << 'EOF' > "${CLOUD_INIT_FILE}"
#cloud-config
package_upgrade: true
packages:
  - apt-transport-https
  - ca-certificates
  - curl
  - gnupg
  - lsb-release
  - git
  - ufw

runcmd:
  # Install Docker CE & Docker Compose Plugin
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - systemctl enable docker
  - systemctl start docker

  # Configure UFW firewall
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
EOF

# 3. Create the Azure VM
echo "Creating Azure VM with automated Docker setup..."
az vm create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${VM_NAME}" \
  --image "Ubuntu2204" \
  --size "${VM_SIZE}" \
  --admin-username "${ADMIN_USERNAME}" \
  --generate-ssh-keys \
  --custom-data "${CLOUD_INIT_FILE}" \
  --public-ip-sku Standard \
  -o table

rm -f "${CLOUD_INIT_FILE}"

# 4. Open HTTP and HTTPS Ports on Network Security Group
echo "Opening port 80 and 443 in Azure NSG..."
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 80 --priority 1010 -o table
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 443 --priority 1020 -o table

# 5. Get Public IP Address
VM_PUBLIC_IP=$(az vm show -d -g "${RESOURCE_GROUP}" -n "${VM_NAME}" --query publicIps -o tsv)

echo "======================================================================"
echo " VM CREATED SUCCESSFULLY!"
echo " Public IP Address: ${VM_PUBLIC_IP}"
echo " SSH Command:       ssh ${ADMIN_USERNAME}@${VM_PUBLIC_IP}"
echo "======================================================================"
echo ""
echo "To deploy Merihcare on this VM, run the following commands:"
echo "----------------------------------------------------------------------"
echo "ssh ${ADMIN_USERNAME}@${VM_PUBLIC_IP} << 'ENDSSH'"
echo "  git clone https://github.com/Gfani/Merih-Care.git"
echo "  cd Merih-Care"
echo "  cp .env.production.example .env.production"
echo "  # (Edit .env.production with your production secrets)"
echo "  docker compose up -d"
echo "ENDSSH"
echo "----------------------------------------------------------------------"

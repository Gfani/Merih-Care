@description('The Azure region where resources should be created.')
param location string = resourceGroup().location

@description('The environment prefix for naming resources.')
param environmentName string = 'merihcare-prod'

@description('Administrator username for PostgreSQL Flexible Server.')
param dbAdminUser string = 'merihcare_admin'

@description('Administrator password for PostgreSQL Flexible Server.')
@secure()
param dbAdminPassword string

@description('Cryptographic JWT secret for authentication.')
@secure()
param jwtSecret string

@description('Backend container image to deploy.')
param backendImage string = ''

@description('Chapa live secret key for payment processing.')
@secure()
param chapaSecretKey string = ''

@description('Admin Web container image to deploy.')
param adminWebImage string = ''

// Unique suffix for globally unique resource names
var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'cr${replace(environmentName, '-', '')}${take(uniqueSuffix, 6)}'
var logAnalyticsName = 'log-${environmentName}'
var containerAppEnvName = 'cae-${environmentName}'
var psqlServerName = 'psql-${environmentName}-${take(uniqueSuffix, 6)}'
var storageAccountName = 'st${replace(environmentName, '-', '')}${take(uniqueSuffix, 6)}'
var fileShareName = 'uploads'
var backendAppName = 'app-${environmentName}-backend'
var adminWebAppName = 'app-${environmentName}-admin'

// 1. Azure Container Registry (ACR)
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// 2. Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// 3. Azure Storage Account (for persistent uploads / medical files)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// File service and file share for mounting to Container Apps
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: fileShareName
  properties: {
    shareQuota: 50
  }
}

// 4. PostgreSQL Flexible Server
resource psqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: psqlServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Allow Azure services to access PostgreSQL server
resource psqlFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: psqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Database creation
resource psqlDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: psqlServer
  name: 'merihcare_db'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// 5. Azure Container Apps Managed Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Mount Azure File share as persistent storage in Container App Environment
resource envStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  parent: containerAppEnv
  name: 'uploads-storage'
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

// 6. Azure Container App: NestJS Backend API & WebSockets
resource backendContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto' // Supports HTTP/1.1, HTTP/2, and WebSockets!
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'db-password'
          value: dbAdminPassword
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'chapa-secret'
          value: empty(chapaSecretKey) ? 'sandbox-placeholder-key' : chapaSecretKey
        }
      ]
    }
    template: {
      volumes: [
        {
          name: 'uploads-volume'
          storageType: 'AzureFile'
          storageName: 'uploads-storage'
        }
      ]
      containers: [
        {
          name: 'backend'
          image: empty(backendImage) ? 'mcr.microsoft.com/azuredocs/aci-helloworld:latest' : backendImage
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          volumeMounts: [
            {
              volumeName: 'uploads-volume'
              mountPath: '/app/uploads'
            }
          ]
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'API_PREFIX'
              value: 'api/v1'
            }
            {
              name: 'DB_TYPE'
              value: 'postgres'
            }
            {
              name: 'DB_HOST'
              value: psqlServer.properties.fullyQualifiedDomainName
            }
            {
              name: 'DB_PORT'
              value: '5432'
            }
            {
              name: 'DB_USERNAME'
              value: dbAdminUser
            }
            {
              name: 'DB_PASSWORD'
              secretRef: 'db-password'
            }
            {
              name: 'DB_DATABASE'
              value: 'merihcare_db'
            }
            {
              name: 'DB_SSL'
              value: 'true'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'UPLOADS_DIR'
              value: '/app/uploads'
            }
            {
              name: 'CHAPA_SECRET_KEY'
              secretRef: 'chapa-secret'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/v1/health'
                port: 3000
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// 7. Azure Container App: React / Vite Admin Portal (Nginx)
resource adminWebContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: adminWebAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'admin-web'
          image: empty(adminWebImage) ? 'mcr.microsoft.com/azuredocs/aci-helloworld:latest' : adminWebImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

// Outputs
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output postgresServerFqdn string = psqlServer.properties.fullyQualifiedDomainName
output backendUrl string = 'https://${backendContainerApp.properties.configuration.ingress.fqdn}'
output adminWebUrl string = 'https://${adminWebContainerApp.properties.configuration.ingress.fqdn}'
output adminWebAppName string = adminWebContainerApp.name

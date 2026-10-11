// Potenova Stage 2 infrastructure (ADR-0013, ADR-0019).
//
// Codifies the resources that were first provisioned by hand for the staging
// deploy: Log Analytics, Azure Container Registry, PostgreSQL Flexible Server
// (+ database + "allow Azure services" firewall rule), a Container Apps managed
// environment, and the API Container App (which also serves the web UI on the
// same origin). Everything is pinned to a Canadian region.
//
// This is the source of truth going forward. Deploy into a resource group:
//   az deployment group create -g rg-potenova-dev -f infra/azure/main.bicep \
//     -p main.sample.bicepparam
// Validate without deploying:  az bicep build -f infra/azure/main.bicep
//                              az deployment group what-if -g rg-potenova-dev ...
//
// No real model and no real child data run here: appEnv stays 'staging' (the
// app permits real child data only when appEnv is exactly 'prod', gated to G2).

@description('Azure region — must be Canadian for residency.')
param location string = 'canadacentral'

@description('Globally-unique Azure Container Registry name (letters/numbers only).')
param acrName string = 'acrpotenovadigitery'

@description('Globally-unique PostgreSQL Flexible Server name.')
param pgServerName string = 'psql-potenova-digitery'

@description('PostgreSQL administrator username.')
param pgAdminUser string = 'potenova_admin'

@secure()
@description('PostgreSQL administrator password. Use a URL-safe value (it is embedded in DATABASE_URL).')
param pgAdminPassword string

@description('Container image tag to deploy (built and pushed by the deploy-api workflow).')
param imageTag string = 'v3'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Application environment label. Not prod until the G2 gate.')
param appEnv string = 'staging'

@description('Primary Canadian region label passed to the app config.')
param primaryRegion string = 'ca-central'

@description('DR Canadian region label passed to the app config.')
param drRegion string = 'ca-east'

var pgDatabaseName = 'potenova'
var containerAppName = 'ca-potenova-api'
var environmentName = 'cae-potenova-dev'
var logAnalyticsName = 'log-potenova-dev'

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    // Admin disabled: GitHub pushes via a federated service principal (AcrPush),
    // the Container App pulls via its managed identity (AcrPull, below).
    adminUserEnabled: false
  }
}

// AcrPull role definition id (built-in).
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: pgAdminUser
    administratorLoginPassword: pgAdminPassword
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

resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: pg
  name: pgDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Lets Azure services (the Container App) reach the server. Dev convenience;
// production moves the database onto a private network (ADR-0019 hardening).
resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: pg
  name: 'allow-azure-services'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource managedEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

var databaseUrl = 'postgresql://${pgAdminUser}:${pgAdminPassword}@${pg.properties.fullyQualifiedDomainName}:5432/${pgDatabaseName}?sslmode=require'

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'db-url'
          value: databaseUrl
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/potenova-api:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'APP_ENV'
              value: appEnv
            }
            {
              name: 'PRIMARY_REGION'
              value: primaryRegion
            }
            {
              name: 'DR_REGION'
              value: drRegion
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'db-url'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
  dependsOn: [
    pgDatabase
    pgFirewallAzure
  ]
}

// Let the app's managed identity pull images from the registry.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.id, 'AcrPull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output apiUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output acrLoginServer string = acr.properties.loginServer
output postgresFqdn string = pg.properties.fullyQualifiedDomainName

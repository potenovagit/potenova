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
  'qa'
  'staging'
  'prod'
])
@description('Application environment label. Not prod until the G2 gate.')
param appEnv string = 'dev'

@description('Primary Canadian region label passed to the app config.')
param primaryRegion string = 'ca-central'

@description('DR Canadian region label passed to the app config.')
param drRegion string = 'ca-east'

@description('Create the shared Azure Container Registry in THIS deployment. True for the dev/shared stack (which owns the registry); false for qa and prod, which pull from it. See ADR-0020 and infra/azure/README.')
param createRegistry bool = true

@description('Resource group that holds the shared registry — used by qa/prod (createRegistry=false) to reference it cross-group.')
param sharedRegistryResourceGroup string = resourceGroup().name

@description('Baseline replica count. 0 enables scale-to-zero (cheap non-prod: dev/qa); prod runs warm at 1.')
param minReplicas int = 1

// Per-environment resource names so one template stands up dev, qa and prod as
// distinct stacks (ADR-0020). The registry is shared and keeps its fixed name.
var pgDatabaseName = 'potenova'
var containerAppName = 'ca-potenova-api-${appEnv}'
var environmentName = 'cae-potenova-${appEnv}'
var logAnalyticsName = 'log-potenova-${appEnv}'

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

// One shared registry for all environments (ADR-0020): the dev/shared stack
// creates it; qa and prod reference the same registry so the promote pipeline
// builds an image once and every environment pulls that identical image.
resource acrNew 'Microsoft.ContainerRegistry/registries@2023-07-01' = if (createRegistry) {
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

resource acrExisting 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (!createRegistry) {
  name: acrName
  scope: resourceGroup(sharedRegistryResourceGroup)
}

var acrLoginServer = createRegistry ? acrNew.properties.loginServer : acrExisting.properties.loginServer

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
          server: acrLoginServer
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
          image: '${acrLoginServer}/potenova-api:${imageTag}'
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
        minReplicas: minReplicas
        maxReplicas: 2
      }
    }
  }
  dependsOn: [
    pgDatabase
    pgFirewallAzure
  ]
}

// Let the app's managed identity pull images from the registry. Created here
// only for the dev/shared stack that owns the registry (same resource group).
// For qa and prod (createRegistry=false) the registry lives in another group, so
// grant AcrPull to each app's managed identity out-of-band after deploy:
//   az role assignment create --assignee <app-principal-id> --role AcrPull \
//     --scope <shared-registry-resource-id>
// (documented in infra/azure/README).
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRegistry) {
  name: guid(acrNew.id, containerApp.id, 'AcrPull')
  scope: acrNew
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output apiUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output acrLoginServer string = acrLoginServer
output postgresFqdn string = pg.properties.fullyQualifiedDomainName

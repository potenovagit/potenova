using './main.bicep'

// QA stack — deploy into the shared non-prod resource group (rg-potenova-nonprod).
// References the shared registry created by the dev stack (createRegistry=false).
//   az deployment group create -g rg-potenova-nonprod -f infra/azure/main.bicep \
//     -p infra/azure/qa.bicepparam -p pgAdminPassword=$PGPASS
// After deploy, grant the app's identity AcrPull on the shared registry (README).

param location = 'canadacentral'
param acrName = 'acrpotenovadigitery'
param pgServerName = 'psql-potenova-qa'
param pgAdminUser = 'potenova_admin'
param pgAdminPassword = '<set-me-url-safe>'
param appEnv = 'qa'
param primaryRegion = 'ca-central'
param drRegion = 'ca-east'
param createRegistry = false
param minReplicas = 1 // warm (no cold-start lag); bump back to 0 for scale-to-zero

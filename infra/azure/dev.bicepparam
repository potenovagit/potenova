using './main.bicep'

// DEV stack — deploy into the shared non-prod resource group (rg-potenova-nonprod).
// The shared registry already exists in rg-potenova-dev (earlier staging deploy),
// so this stack references it (createRegistry=false) rather than recreating it.
// Pass the password on the command line; never commit a real one:
//   az deployment group create -g rg-potenova-nonprod -f infra/azure/main.bicep \
//     -p infra/azure/dev.bicepparam -p pgAdminPassword=$PGPASS

param location = 'canadacentral'
param acrName = 'acrpotenovadigitery'
param pgServerName = 'psql-potenova-dev'
param pgAdminUser = 'potenova_admin'
param pgAdminPassword = '<set-me-url-safe>'
param appEnv = 'dev'
param primaryRegion = 'ca-central'
param drRegion = 'ca-east'
param createRegistry = false
param minReplicas = 0 // scale-to-zero: dev costs nothing while idle

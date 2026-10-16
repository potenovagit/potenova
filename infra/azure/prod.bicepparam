using './main.bicep'

// PROD stack — deploy into the ISOLATED prod resource group (rg-potenova-prod),
// separate from non-prod for blast-radius + SEC-002 separation. References the
// shared registry in the non-prod group (createRegistry=false).
//   az deployment group create -g rg-potenova-prod -f infra/azure/main.bicep \
//     -p infra/azure/prod.bicepparam -p pgAdminPassword=$PGPASS
// After deploy, grant the app's identity AcrPull on the shared registry (README).
//
// appEnv=prod flips allowRealChildData on in the app — but prod stays fail-closed
// (no approved model, empty caps) and processes real child data only after the
// G2 gate is signed. Deploying this stack does NOT cross that line.

param location = 'canadacentral'
param acrName = 'acrpotenovadigitery'
param pgServerName = 'psql-potenova-prod'
param pgAdminUser = 'potenova_admin'
param pgAdminPassword = '<set-me-url-safe>'
param appEnv = 'prod'
param primaryRegion = 'ca-central'
param drRegion = 'ca-east'
param createRegistry = false
param minReplicas = 1 // prod runs warm (no cold-start for real traffic)

using './main.bicep'

// Copy to main.bicepparam (gitignored) and fill in the password, or pass
// -p pgAdminPassword=... on the command line. Never commit a real password.

param location = 'canadacentral'
param acrName = 'acrpotenovadigitery'
param pgServerName = 'psql-potenova-digitery'
param pgAdminUser = 'potenova_admin'
param pgAdminPassword = '<set-me-url-safe>'
param appEnv = 'staging'
param primaryRegion = 'ca-central'
param drRegion = 'ca-east'

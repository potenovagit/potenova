# Potenova Azure infrastructure (Bicep)

`main.bicep` is the infrastructure-as-code definition of the Stage 2 staging
stack (ADR-0013, ADR-0019): Log Analytics, Azure Container Registry, PostgreSQL
Flexible Server (+ database + "allow Azure services" firewall rule), a Container
Apps managed environment, and the API Container App (which also serves the web
UI on the same origin). All in a Canadian region.

It reproduces what was first provisioned by hand, so the environment can be
rebuilt, torn down, or stood up fresh from one command instead of click-by-click.

## Validate (no changes to Azure)

Compile-check the template:

```
az bicep build --file infra/azure/main.bicep
```

Preview what a deploy would change against an existing resource group (read-only):

```
az deployment group what-if `
  --resource-group rg-potenova-dev `
  --template-file infra/azure/main.bicep `
  --parameters main.sample.bicepparam `
  --parameters pgAdminPassword=$PGPASS
```

> Note: against the hand-built resources, `what-if` will show some diffs (e.g.
> an auto-named Log Analytics workspace). That's expected — this template is the
> definition to converge on, best applied to a **fresh** resource group or
> reconciled deliberately. Don't blind-apply it over the live database.

## Deploy (fresh environment)

```
az group create -n rg-potenova-dev -l canadacentral
az deployment group create `
  --resource-group rg-potenova-dev `
  --template-file infra/azure/main.bicep `
  --parameters main.sample.bicepparam `
  --parameters pgAdminPassword=$PGPASS
```

The image must already exist in the registry (built by the `deploy-api` GitHub
Actions workflow). The deploy outputs the API URL.

## Parameters

Copy `main.sample.bicepparam` to `main.bicepparam` (gitignored) and fill in the
password, or pass `-p pgAdminPassword=...` on the command line. `appEnv` stays
`staging` until the G2 gate — the app permits real child data only when it is
exactly `prod`.

## Not yet in code (hardening follow-ups, ADR-0019)

- Private networking for PostgreSQL (replacing the public "allow Azure services"
  rule).
- A federated service principal for registry auth (replacing ACR admin creds).
- Real authentication in front of the app; a custom domain.
- An automated deploy step wired into CI behind an approval gate.

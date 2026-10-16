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

## Done

- **CI/CD**: the `deploy-api` workflow builds, pushes, and rolls out the image,
  authenticating via GitHub OIDC federated to a service principal — no stored
  credentials.
- **Registry auth**: ACR admin is disabled. GitHub pushes with the SP (AcrPush);
  the Container App pulls with its system-assigned managed identity (AcrPull).
  On a fresh deploy the AcrPull role is assigned after the app's identity exists,
  so the first revision may retry its pull for a minute before it succeeds.

## Multi-environment promotion (ADR-0020)

Three environments — **dev**, **qa**, **prod** — with a build-once,
promote-many pipeline (`.github/workflows/promote.yml`). On green CI on `main`,
one image is built and promoted dev → qa → prod automatically, each stage gated
by `infra/smoke.mjs`. Topology: **prod isolated** in its own resource group;
**dev + qa share** the non-prod group, which also holds the single shared
registry.

`main.bicep` is parameterised so the same template stands up all three stacks
(`appEnv`, `createRegistry`, `sharedRegistryResourceGroup`, `minReplicas`), with
`dev.bicepparam` / `qa.bicepparam` / `prod.bicepparam`.

> The Bicep changes for multi-env were authored but not `az bicep build`-verified
> in this session — **compile-check and what-if before applying:** > `az bicep build --file infra/azure/main.bicep`

### One-time provisioning (owner)

```
# resource groups
az group create -n rg-potenova-nonprod -l canadacentral
az group create -n rg-potenova-prod    -l canadacentral

# dev — creates the SHARED registry (createRegistry=true)
az deployment group create -g rg-potenova-nonprod -f infra/azure/main.bicep \
  -p infra/azure/dev.bicepparam -p pgAdminPassword=$PGPASS
# qa — same non-prod group, references the shared registry
az deployment group create -g rg-potenova-nonprod -f infra/azure/main.bicep \
  -p infra/azure/qa.bicepparam -p pgAdminPassword=$PGPASS
# prod — isolated group, references the shared registry
az deployment group create -g rg-potenova-prod -f infra/azure/main.bicep \
  -p infra/azure/prod.bicepparam -p pgAdminPassword=$PGPASS

# cross-group AcrPull for qa + prod app identities (dev is granted in-template)
ACR_ID=$(az acr show -n acrpotenovadigitery -g rg-potenova-nonprod --query id -o tsv)
for app_rg in "ca-potenova-api-qa rg-potenova-nonprod" "ca-potenova-api-prod rg-potenova-prod"; do
  set -- $app_rg
  PID=$(az containerapp show -n "$1" -g "$2" --query identity.principalId -o tsv)
  az role assignment create --assignee "$PID" --role AcrPull --scope "$ACR_ID"
done
```

### GitHub wiring (owner)

- **Secrets** (already used by the deploy workflow): `AZURE_CLIENT_ID`,
  `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. The service principal needs AcrPush
  on the shared registry and Contributor on **both** resource groups.
- **Variables**: `DEV_API_URL`, `QA_API_URL`, `PROD_API_URL` — each app's
  `https://<fqdn>` (the Bicep `apiUrl` output), used by the smoke check.
- **Environments**: create `dev`, `qa`, `prod` (no required reviewers — auto
  promotion per ADR-0020; add reviewers later to introduce a human gate).

At the G2 gate, set `SMOKE_EXPECT_FAILCLOSED=false` for the prod stage and wire
the approved model/caps as a separate, audited change — see ADR-0020.

## Not yet in code (hardening follow-ups, ADR-0019)

- Private networking for PostgreSQL (replacing the public "allow Azure services"
  rule).
- Real authentication in front of the app; a custom domain.
- A human approval gate (GitHub environment required reviewers) before prod, if
  auto-promotion is later deemed too permissive.

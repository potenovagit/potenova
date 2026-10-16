// Post-deploy smoke check (ADR-0020). Gates promotion: the pipeline runs this
// against each environment right after it deploys, and only advances to the next
// stage on exit 0. No dependencies — Node 22 global fetch.
//
//   node infra/smoke.mjs
//
// Env:
//   SMOKE_URL                base origin, e.g. https://ca-potenova-api-qa.<region>.azurecontainerapps.io
//   SMOKE_ENV                expected APP_ENV the app should report (dev | qa | prod)
//   SMOKE_EXPECT_FAILCLOSED  'true' (default) asserts prod is still fail-closed —
//                            no production-approved model, prodReady=false. This is
//                            the PRE-G2 posture; flip to 'false' only once the G2
//                            gate is signed and prod is intentionally live.
//   SMOKE_TIMEOUT_MS         per-request timeout (default 10000)

const url = (process.env.SMOKE_URL ?? '').replace(/\/+$/, '');
const expectedEnv = process.env.SMOKE_ENV ?? '';
const expectFailClosed = (process.env.SMOKE_EXPECT_FAILCLOSED ?? 'true') !== 'false';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10000);

if (!url) fail('SMOKE_URL is required');

function fail(msg) {
  console.error(`✗ smoke: ${msg}`);
  process.exit(1);
}

async function get(path, headers = {}) {
  const ctl = AbortSignal.timeout(timeoutMs);
  const res = await fetch(`${url}${path}`, { headers, signal: ctl });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push(`✓ ${name}`);
  } catch (e) {
    checks.push(`✗ ${name} — ${e.message}`);
    throw e;
  }
}

try {
  await check('healthz 200', async () => {
    const r = await get('/healthz');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });

  await check('readyz 200 + Canadian region', async () => {
    const r = await get('/readyz');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!String(r.body?.primaryRegion ?? '').startsWith('ca-'))
      throw new Error(`non-Canadian primaryRegion: ${r.body?.primaryRegion}`);
  });

  if (expectedEnv) {
    await check(`reports environment '${expectedEnv}'`, async () => {
      const r = await get('/readyz');
      if (r.body?.environment !== expectedEnv)
        throw new Error(`got '${r.body?.environment}', expected '${expectedEnv}'`);
    });
  }

  // Governance gate: until G2 is signed, prod must still be fail-closed — no
  // production-approved model and prodReady=false. If someone has wired a model
  // or flipped every approval, this FAILS the promotion on purpose.
  if (expectFailClosed) {
    await check('fail-closed posture (no prod model, prodReady=false)', async () => {
      const r = await get('/operator/status', {
        'x-actor-type': 'operator',
        'x-actor-alias': 'smoke',
      });
      if (r.status !== 200) throw new Error(`operator/status ${r.status}`);
      if (r.body?.prodReady === true)
        throw new Error('prodReady=true — prod would accept real child data; blocked pre-G2');
    });
  }

  console.log(checks.join('\n'));
  console.log(`✓ smoke passed for ${url} (${expectedEnv || 'env n/a'})`);
} catch {
  console.error(checks.join('\n'));
  fail(`one or more checks failed for ${url}`);
}

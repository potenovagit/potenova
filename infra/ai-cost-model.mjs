// AI inference cost model — self-hosted (fixed GPU) vs managed API (per-token).
//
// Decision support for the provider strategy (ER-16 / ADR-0005): self-hosting an
// in-region model removes the third-party abuse-monitoring/retention surface, but
// trades variable per-token cost for mostly-fixed GPU cost. Whether that is
// cheaper depends on volume and — for a spiky kids'-tutoring load — on how much of
// the GPU you pay for sits idle. This prints both monthly costs, the effective
// cost per request, the GPU utilization, and the crossover volume.
//
//   node infra/ai-cost-model.mjs [--key=value ...]
//   node infra/ai-cost-model.mjs --help
//
// ALL DEFAULTS ARE ILLUSTRATIVE PLACEHOLDERS — not quotes. Real token prices and
// GPU rates are unit economics (EVIDENCE REQUIRED, ER-01/NFR-14): get current
// numbers from your provider + cloud and pass them in. Ops labour, GPU cold-start,
// storage and egress are NOT modelled.

const DEFAULTS = {
  // --- Demand ---
  requestsPerMonth: 100_000, // model calls / month (sessions × calls per session)
  peakRequestsPerSec: 2, // busiest-second request rate — sizes the GPU fleet
  inputTokensPerReq: 400, // prompt tokens per call
  outputTokensPerReq: 300, // completion tokens per call
  // --- Managed API ($ per 1,000,000 tokens) ---
  apiInputRate: 0.15,
  apiOutputRate: 0.6,
  // --- Self-hosted GPU ---
  gpuHourlyRate: 1.2, // $ per GPU-hour (your chosen instance)
  gpuThroughputTokensPerSec: 800, // sustained OUTPUT tokens/sec per GPU for the model
  gpuHoursPerMonth: 730, // 730 = always-on; lower = scheduled/scaled (e.g. 12h/day ≈ 365)
};

const HELP = `AI inference cost model — self-host vs managed API

Usage: node infra/ai-cost-model.mjs [--key=value ...]

Keys (all optional; illustrative defaults shown):
${Object.entries(DEFAULTS)
  .map(([k, v]) => `  --${k}=${v}`)
  .join('\n')}

All defaults are placeholders. Pass your own token prices and GPU rate.`;

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') return 'help';
    const m = /^--([A-Za-z]+)=(.+)$/.exec(arg);
    if (!m) continue;
    const [, key, raw] = m;
    if (!(key in out)) {
      console.error(`unknown option --${key}`);
      process.exit(2);
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      console.error(`--${key} must be a non-negative number (got '${raw}')`);
      process.exit(2);
    }
    out[key] = n;
  }
  return out;
}

const money = (n) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money4 = (n) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const int = (n) => Math.round(n).toLocaleString('en-CA');

function model(p) {
  // Managed API: linear in volume.
  const apiCostPerReq =
    (p.inputTokensPerReq * p.apiInputRate + p.outputTokensPerReq * p.apiOutputRate) / 1e6;
  const apiMonthly = p.requestsPerMonth * apiCostPerReq;

  // Self-hosted: size the fleet for PEAK output throughput, pay for it by the hour.
  const peakOutTokPerSec = p.peakRequestsPerSec * p.outputTokensPerReq;
  const gpusNeeded = Math.max(1, Math.ceil(peakOutTokPerSec / p.gpuThroughputTokensPerSec));
  const selfHostMonthly = gpusNeeded * p.gpuHoursPerMonth * p.gpuHourlyRate;
  const selfHostCostPerReq =
    p.requestsPerMonth > 0 ? selfHostMonthly / p.requestsPerMonth : Infinity;

  // How much of the paid GPU capacity the average load actually uses (the spiky-demand penalty).
  const avgOutTokPerSec = (p.requestsPerMonth * p.outputTokensPerReq) / (p.gpuHoursPerMonth * 3600);
  const capacityTokPerSec = gpusNeeded * p.gpuThroughputTokensPerSec;
  const utilisation = capacityTokPerSec > 0 ? avgOutTokPerSec / capacityTokPerSec : 0;

  // Crossover volume: at THIS GPU sizing, where does API cost equal self-host cost?
  const crossoverRequests = apiCostPerReq > 0 ? selfHostMonthly / apiCostPerReq : Infinity;

  return {
    apiCostPerReq,
    apiMonthly,
    peakOutTokPerSec,
    gpusNeeded,
    selfHostMonthly,
    selfHostCostPerReq,
    utilisation,
    crossoverRequests,
  };
}

const p = parseArgs(process.argv.slice(2));
if (p === 'help') {
  console.log(HELP);
  process.exit(0);
}
const r = model(p);

const line = '─'.repeat(64);
console.log(line);
console.log('AI inference cost model — self-host vs managed API  (ILLUSTRATIVE)');
console.log(line);
console.log('Assumptions');
console.log(
  `  volume            ${int(p.requestsPerMonth)} req/mo, peak ${p.peakRequestsPerSec} req/s`,
);
console.log(
  `  tokens/req        ${int(p.inputTokensPerReq)} in + ${int(p.outputTokensPerReq)} out`,
);
console.log(`  API rate          ${money(p.apiInputRate)}/1M in, ${money(p.apiOutputRate)}/1M out`);
console.log(
  `  GPU               ${money(p.gpuHourlyRate)}/GPU-hr, ${int(p.gpuThroughputTokensPerSec)} out-tok/s, ${int(p.gpuHoursPerMonth)} hr/mo`,
);
console.log(line);
console.log('Managed API (pay-per-use)');
console.log(`  cost / request    ${money4(r.apiCostPerReq)}`);
console.log(`  monthly           ${money(r.apiMonthly)}`);
console.log('Self-hosted GPU (fixed)');
console.log(
  `  GPUs for peak     ${r.gpusNeeded}  (peak ${int(r.peakOutTokPerSec)} out-tok/s ÷ ${int(p.gpuThroughputTokensPerSec)}/GPU)`,
);
console.log(`  monthly           ${money(r.selfHostMonthly)}`);
console.log(`  effective / req   ${money4(r.selfHostCostPerReq)}`);
console.log(`  avg utilisation   ${(r.utilisation * 100).toFixed(1)}%  (rest is paid-for idle)`);
console.log(line);

const cheaper = r.selfHostMonthly < r.apiMonthly ? 'self-host' : 'managed API';
const delta = Math.abs(r.selfHostMonthly - r.apiMonthly);
console.log(`At ${int(p.requestsPerMonth)} req/mo: ${cheaper} is cheaper by ${money(delta)}/mo.`);
if (Number.isFinite(r.crossoverRequests)) {
  console.log(
    `Crossover ≈ ${int(r.crossoverRequests)} req/mo (at this peak/GPU sizing): below it the API wins, above it self-host wins.`,
  );
}
console.log(line);
console.log('Caveats: numbers are illustrative placeholders (EVIDENCE REQUIRED).');
console.log('Self-host cost steps UP when peak exceeds the current GPU fleet; low');
console.log('utilisation is the spiky-demand penalty. Ops labour, cold-start,');
console.log('storage and egress are not modelled. Pass --help for options.');

/**
 * Local DEV entry point only.
 *
 * Sets safe development defaults for the config the API requires, then boots the
 * real server. These regions are the Canadian allowlist already used throughout
 * the codebase; `dev` is obviously non-production. Production runs `server.ts`
 * directly (built to dist/), which has NO defaults and fails closed on missing
 * config — this file is never part of the production image. Running it resolves
 * the workspace packages from source (tsconfig.dev.json), so no build is needed.
 */
export {}; // ensure this file is treated as a module (enables top-level await)

process.env.APP_ENV ??= 'dev';
process.env.PRIMARY_REGION ??= 'ca-central';
process.env.DR_REGION ??= 'ca-east';
process.env.PORT ??= '8080';

await import('./server');

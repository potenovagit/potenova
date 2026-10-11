# Production image for the Potenova API (Stage 2; ADR-0018/0019).
#
# Runs the strict server.ts entry (no dev defaults; fails closed on missing
# config). Config (APP_ENV, PRIMARY_REGION, DR_REGION, DATABASE_URL, PORT) is
# injected at runtime by the platform, never baked in.
#
# The API is bundled to a single ESM file with esbuild (workspace packages
# inlined; pg/pglite/drizzle/hono/jose kept external) so it runs on plain `node`.
# Dev dependencies (tsc, vite, tsx, esbuild) are used only to build, then pruned
# — the runtime image carries no build toolchain.

FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps

RUN npm ci
# Compile workspace packages (so the bundler resolves @potenova/* from dist),
# build the web UI (same-origin API base), then bundle the API to dist/server.mjs.
RUN npm run typecheck
RUN VITE_API_BASE="" npm run build --workspace @potenova/web
RUN npm run build --workspace @potenova/api
# Drop devDependencies (tsc, vite, tsx, esbuild, types) from the runtime image.
RUN npm prune --omit=dev

ENV POTENOVA_WEB_ROOT=apps/web/dist
EXPOSE 8080
USER node
CMD ["node", "services/api/dist/server.mjs"]

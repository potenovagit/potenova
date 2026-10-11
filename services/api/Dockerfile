# Production image for the Potenova API (Stage 2; ADR-0018/0019).
#
# Runs the strict server.ts entry (no dev defaults; fails closed on missing
# config). Config (APP_ENV, PRIMARY_REGION, DR_REGION, DATABASE_URL, PORT) is
# injected at runtime by the platform, never baked in.
#
# The API is executed with tsx, which resolves the workspace packages from
# source via tsconfig.dev.json's path map. The codebase uses extensionless ESM
# imports, which plain `node` cannot resolve on the emitted JS; tsx resolves
# them. Producing a bundled single-file artifact runnable by plain node is a
# later production-hardening step.

FROM node:22-bookworm-slim
WORKDIR /app
# NODE_ENV is intentionally NOT set to production: the build and runtime need
# devDependencies (tsc, vite, tsx). App config comes from APP_ENV, not NODE_ENV.

# Manifests first for layer caching.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json tsconfig.dev.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN npm ci

# Build the web UI pointed at the same origin ('' API base) so this one service
# serves both the API and the app with no CORS (POTENOVA_WEB_ROOT, below).
RUN VITE_API_BASE="" npm run build --workspace @potenova/web
ENV POTENOVA_WEB_ROOT=apps/web/dist

EXPOSE 8080
USER node
CMD ["npx", "tsx", "--tsconfig", "tsconfig.dev.json", "services/api/src/server.ts"]

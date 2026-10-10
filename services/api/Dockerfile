# Production image for the Potenova API (Stage 2; ADR-0018).
# Runs the strict server.ts entry — no dev defaults, fails closed on missing
# config. Config (APP_ENV, PRIMARY_REGION, DR_REGION, DATABASE_URL, PORT) is
# injected at runtime by the platform, never baked into the image.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Manifests first for layer caching.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN npm ci
# tsc -b compiles every workspace package to its dist/ (what the server imports).
RUN npm run typecheck

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production
WORKDIR /app
# Bring the installed modules and compiled output across.
COPY --from=build /app /app
# Default listen port; the platform may override via PORT.
EXPOSE 8080
# A non-root runtime user (the base image ships one named "node").
USER node
CMD ["node", "services/api/dist/server.js"]

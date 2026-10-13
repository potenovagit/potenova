import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@potenova/contracts': pkg('contracts'),
      '@potenova/config': pkg('config'),
      '@potenova/domain-core': pkg('domain-core'),
      '@potenova/identity': pkg('identity'),
      '@potenova/curriculum': pkg('curriculum'),
      '@potenova/learner-state': pkg('learner-state'),
      '@potenova/ai-gateway': pkg('ai-gateway'),
      '@potenova/content': pkg('content'),
      '@potenova/diagnostic': pkg('diagnostic'),
      '@potenova/planner': pkg('planner'),
      '@potenova/learner-ux': pkg('learner-ux'),
      '@potenova/english': pkg('english'),
      '@potenova/parent': pkg('parent'),
      '@potenova/safety': pkg('safety'),
      '@potenova/billing': pkg('billing'),
      '@potenova/operator': pkg('operator'),
      '@potenova/policy': pkg('policy'),
      '@potenova/persistence': pkg('persistence'),
      '@potenova/requirement-trace': pkg('requirement-trace'),
      '@potenova/fixtures': pkg('fixtures'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/**/test/**/*.test.ts',
      'services/**/test/**/*.test.ts',
      'apps/**/test/**/*.test.ts',
    ],
    reporters: ['default'],
    // The PGlite-backed API tests spin up a WASM Postgres per app; on slower CI
    // runners that can exceed the 5s default. Give generous margin so a slow
    // runner is never a flaky failure (these tests are ~1s locally).
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      enabled: false,
    },
  },
});

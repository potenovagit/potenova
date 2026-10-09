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
      '@potenova/requirement-trace': pkg('requirement-trace'),
      '@potenova/fixtures': pkg('fixtures'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/test/**/*.test.ts', 'services/**/test/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      enabled: false,
    },
  },
});

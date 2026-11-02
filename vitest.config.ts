import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/types.ts'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
      reporter: ['text-summary', 'text'],
    },
  },
});

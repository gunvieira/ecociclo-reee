import { defineConfig } from 'vitest/config';

// Fuso fixo: testes de data dão o mesmo resultado em qualquer máquina ou CI
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});

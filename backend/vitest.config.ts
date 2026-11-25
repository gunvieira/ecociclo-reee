import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Garante que os testes nunca usem o Firestore real, mesmo com a chave presente
    env: {
      FORCE_LOCAL_STORAGE: 'true',
      LOCAL_AUTH_SECRET: 'segredo-apenas-para-testes',
    },
  },
});

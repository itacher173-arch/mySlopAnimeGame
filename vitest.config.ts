/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'], // Опционально: файл подготовки перед тестами
    deps: {
      interopDefault: true,
    },
  },
});

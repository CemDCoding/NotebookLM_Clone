import { defineConfig } from 'tsup';

// Emit both ESM (Next.js) and CommonJS (NestJS) so each app can consume the package natively.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});

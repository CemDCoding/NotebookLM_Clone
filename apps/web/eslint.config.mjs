import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import rootConfig from '../../eslint.config.mjs';

export default tseslint.config(
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts'],
  },
  ...nextVitals,
  ...rootConfig,
);

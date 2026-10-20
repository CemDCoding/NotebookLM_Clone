import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships prebuilt ESM, but transpiling keeps it in sync during `pnpm dev`.
  transpilePackages: ['@notebooklm/shared'],
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
  // Agent instructions live in CLAUDE.md; without this, `next dev` writes an AGENTS.md
  // depending on whether it detects an AI agent, which makes the working tree nondeterministic.
  agentRules: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;

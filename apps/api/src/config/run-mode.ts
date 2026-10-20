import type { ModuleMetadata } from '@nestjs/common';

export const RUN_MODES = ['all', 'api', 'worker'] as const;

export type RunMode = (typeof RUN_MODES)[number];

export type ModuleImport = NonNullable<ModuleMetadata['imports']>[number];

export interface RunModeModules {
  /** Loaded in every mode, e.g. database and health (the worker still answers `/health`). */
  always: ModuleImport[];
  /** HTTP controllers of the feature modules. */
  http: ModuleImport[];
  /** pg-boss workers that process jobs. */
  worker: ModuleImport[];
}

/**
 * Returns the modules to load for a RUN_MODE (apps/api/CLAUDE.md "RUN_MODE").
 * Keeping this switch in one place lets API and worker run as separate services
 * later without code changes (CLAUDE.md section 9).
 */
export function selectModules(runMode: RunMode, modules: RunModeModules): ModuleImport[] {
  return [
    ...modules.always,
    ...(runMode === 'worker' ? [] : modules.http),
    ...(runMode === 'api' ? [] : modules.worker),
  ];
}

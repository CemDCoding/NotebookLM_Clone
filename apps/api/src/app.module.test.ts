import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { RUN_MODE_MODULES } from './app.module';
import { type ModuleImport, type RunMode, selectModules } from './config';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './ingestion/ingestion.module';
import { UsageCleanupJob } from './limits/usage-cleanup.job';
import { LlmModule } from './llm/llm.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { QueueModule } from './queue/queue.module';
import { SourcesModule } from './sources/sources.module';

type ModuleClass = abstract new (...args: never[]) => unknown;

// The metadata keys Nest uses for `@Module({ controllers, providers })`. They
// match the property names of a dynamic module, so one key reads both forms.
type CollectedMetadata = 'controllers' | 'providers';

// A module import is a class, a dynamic module (`{ module, imports, controllers }`)
// or a promise/forward reference. The app only uses the first two.
function collect(
  key: CollectedMetadata,
  imports: readonly ModuleImport[],
  seen = new Set<unknown>(),
): unknown[] {
  return imports.flatMap((entry) => {
    if (seen.has(entry)) return [];
    seen.add(entry);
    if (typeof entry === 'function') {
      const moduleClass = entry as ModuleClass;
      const own = (Reflect.getMetadata(key, moduleClass) ?? []) as unknown[];
      const nested = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ??
        []) as ModuleImport[];
      return [...own, ...collect(key, nested, seen)];
    }
    if (typeof entry === 'object' && 'module' in entry) {
      return [
        ...(entry[key] ?? []),
        ...collect(key, [entry.module, ...(entry.imports ?? [])], seen),
      ];
    }
    return [];
  });
}

function controllersOf(imports: readonly ModuleImport[]): unknown[] {
  return collect('controllers', imports);
}

function providersOf(imports: readonly ModuleImport[]): unknown[] {
  return collect('providers', imports);
}

function modulesFor(runMode: RunMode): ModuleImport[] {
  return selectModules(runMode, RUN_MODE_MODULES);
}

describe('RUN_MODE_MODULES', () => {
  it.each<RunMode>(['all', 'api', 'worker'])(
    'loads queue and LLM provider layer for RUN_MODE=%s',
    (runMode) => {
      expect(modulesFor(runMode)).toEqual(expect.arrayContaining([QueueModule, LlmModule]));
    },
  );

  it('runs the ingestion worker next to the HTTP API for RUN_MODE=all', () => {
    expect(modulesFor('all')).toEqual(
      expect.arrayContaining([IngestionModule, NotebooksModule, SourcesModule]),
    );
  });

  it('only enqueues for RUN_MODE=api, without the ingestion worker', () => {
    const modules = modulesFor('api');

    expect(modules).toEqual(expect.arrayContaining([NotebooksModule, SourcesModule]));
    expect(modules).not.toContain(IngestionModule);
  });

  it('registers only the health endpoint and the worker for RUN_MODE=worker', () => {
    const modules = modulesFor('worker');

    expect(modules).toContain(IngestionModule);
    expect(controllersOf(modules)).toEqual([HealthController]);
  });

  // The job registers its handler and schedule only where workers run, so it
  // must be loaded in every mode for a separate worker service to clean up.
  it.each<RunMode>(['all', 'api', 'worker'])(
    'loads the usage cleanup job for RUN_MODE=%s',
    (runMode) => {
      expect(providersOf(modulesFor(runMode))).toContain(UsageCleanupJob);
    },
  );
});

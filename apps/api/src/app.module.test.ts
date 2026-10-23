import { METHOD_METADATA, MODULE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { describe, expect, it } from 'vitest';
import { RUN_MODE_MODULES } from './app.module';
import { ChatModule } from './chat/chat.module';
import { IS_PUBLIC_KEY } from './common/decorators';
import { type ModuleImport, type RunMode, selectModules } from './config';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './ingestion/ingestion.module';
import { UsageCleanupJob } from './limits/usage-cleanup.job';
import { LlmModule } from './llm/llm.module';
import { ModelsController } from './llm/models.controller';
import { ModelsModule } from './llm/models.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { QueueModule } from './queue/queue.module';
import { RetrievalModule } from './retrieval/retrieval.module';
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

  it.each<RunMode>(['all', 'api'])('loads chat and retrieval for RUN_MODE=%s', (runMode) => {
    expect(modulesFor(runMode)).toEqual(expect.arrayContaining([ChatModule, RetrievalModule]));
  });

  it.each<RunMode>(['all', 'api'])('serves the model list for RUN_MODE=%s', (runMode) => {
    const modules = modulesFor(runMode);

    expect(modules).toContain(ModelsModule);
    expect(controllersOf(modules)).toContain(ModelsController);
  });

  it('loads neither chat nor retrieval for RUN_MODE=worker', () => {
    const modules = modulesFor('worker');

    expect(modules).not.toContain(ChatModule);
    expect(modules).not.toContain(RetrievalModule);
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

type ControllerClass = abstract new (...args: never[]) => object;

interface RouteArgument {
  index: number;
  schema?: unknown;
}

/** Every route handler of a controller: the prototype methods carrying an HTTP method. */
function routeHandlers(controller: ControllerClass): [string, object][] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name): [string, unknown] => [name, prototype[name]])
    .filter((entry): entry is [string, object] => {
      const handler = entry[1];
      return typeof handler === 'function' && Reflect.hasMetadata(METHOD_METADATA, handler);
    });
}

// Every controller of every mode; `all` loads the union of `api` and `worker`.
const ALL_CONTROLLERS = [...new Set(controllersOf(modulesFor('all')))] as ControllerClass[];

// Central route audit (CLAUDE.md section 7): a new controller cannot slip past
// the auth guard or the validation pipe without breaking one of these tests.
describe('Routes of all controllers', () => {
  // A new controller has to be added here, which puts it in front of the two audits below.
  it('finds the controllers of every feature module', () => {
    expect(ALL_CONTROLLERS.map((controller) => controller.name).sort()).toEqual([
      'AccountController',
      'ChatController',
      'HealthController',
      'ModelsController',
      'NotebooksController',
      'SourcesController',
    ]);
  });

  it('keeps every route behind the JWT guard except GET /health', () => {
    const publicRoutes = ALL_CONTROLLERS.flatMap((controller) => {
      const classIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
      return routeHandlers(controller)
        .filter(([, handler]) => classIsPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler))
        .map(([name]) => `${controller.name}.${name}`);
    });

    expect(publicRoutes).toEqual(['HealthController.check']);
  });

  // The global pipe validates only arguments that name a schema; any other
  // body, query or param would reach the service unchecked.
  it('declares a Zod schema for every body, query and path parameter', () => {
    const validated = new Set<string>([
      String(RouteParamtypes.BODY),
      String(RouteParamtypes.QUERY),
      String(RouteParamtypes.PARAM),
    ]);
    const inputs = ALL_CONTROLLERS.flatMap((controller) =>
      routeHandlers(controller).flatMap(([name]) => {
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {}) as Record<
          string,
          RouteArgument
        >;
        return Object.entries(args)
          .filter(([key]) => validated.has(key.split(':')[0] ?? ''))
          .map(([, arg]) => ({ route: `${controller.name}.${name}#${arg.index}`, arg }));
      }),
    );

    // Guards against a vacuous pass if Nest ever moves its metadata.
    expect(inputs.length).toBeGreaterThan(10);
    expect(inputs.filter(({ arg }) => arg.schema === undefined).map(({ route }) => route)).toEqual(
      [],
    );
  });
});

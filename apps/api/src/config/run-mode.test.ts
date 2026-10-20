import { Module } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { type RunModeModules, selectModules } from './run-mode';

@Module({})
class AlwaysModule {}

@Module({})
class HttpModule {}

@Module({})
class WorkerModule {}

const MODULES: RunModeModules = {
  always: [AlwaysModule],
  http: [HttpModule],
  worker: [WorkerModule],
};

describe('selectModules', () => {
  it('loads HTTP and worker modules for RUN_MODE=all', () => {
    expect(selectModules('all', MODULES)).toEqual([AlwaysModule, HttpModule, WorkerModule]);
  });

  it('leaves out the worker for RUN_MODE=api', () => {
    expect(selectModules('api', MODULES)).toEqual([AlwaysModule, HttpModule]);
  });

  it('leaves out the HTTP feature modules for RUN_MODE=worker', () => {
    expect(selectModules('worker', MODULES)).toEqual([AlwaysModule, WorkerModule]);
  });
});

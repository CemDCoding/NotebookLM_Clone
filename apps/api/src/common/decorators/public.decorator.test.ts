import { Controller } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { HealthController } from '../../health/health.controller';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('@Public()', () => {
  const reflector = new Reflector();

  it('marks a controller so the auth guard can skip it', () => {
    @Public()
    @Controller('open')
    class OpenController {}

    @Controller('protected')
    class ProtectedController {}

    expect(reflector.get(IS_PUBLIC_KEY, OpenController)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, ProtectedController)).toBeUndefined();
  });

  it('marks GET /health as public', () => {
    expect(reflector.get(IS_PUBLIC_KEY, HealthController)).toBe(true);
  });
});

import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { describe, expect, it } from 'vitest';
import { CurrentUser } from './current-user.decorator';

type ParamFactory = (data: unknown, context: ExecutionContext) => unknown;

// Nest stores a param decorator's factory in the route-args metadata of the
// handler. Reading it from there tests the decorator exactly as Nest calls it.
function currentUserFactory(): ParamFactory {
  class Controller {
    handler(@CurrentUser() userId: string): string {
      return userId;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Controller, 'handler') as Record<
    string,
    { factory: ParamFactory }
  >;
  const [entry] = Object.values(args);
  if (!entry) {
    throw new Error('@CurrentUser() registered no route argument');
  }
  return entry.factory;
}

function httpContext(request: object): ExecutionContext {
  return new ExecutionContextHost([request, {}, () => undefined]);
}

describe('@CurrentUser()', () => {
  const factory = currentUserFactory();

  it('returns the user ID the auth guard stored on the request', () => {
    const userId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

    expect(factory(undefined, httpContext({ user: { id: userId } }))).toBe(userId);
  });

  it('ignores a user ID in body or query', () => {
    const request = {
      user: { id: 'from-token' },
      body: { userId: 'from-body' },
      query: { userId: 'from-query' },
    };

    expect(factory(undefined, httpContext(request))).toBe('from-token');
  });

  it('fails closed with 401 when no verified user is on the request', () => {
    expect(() => factory(undefined, httpContext({}))).toThrow(UnauthorizedException);
    expect(() => factory(undefined, httpContext({ user: { id: '' } }))).toThrow(
      UnauthorizedException,
    );
  });
});

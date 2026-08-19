import { describe, expect, it } from 'vitest';

import { InfrastructureException } from './infrastructure.exception.js';

class StorageUnreachableException extends InfrastructureException {
  override readonly code = 'STORAGE_UNREACHABLE';

  constructor(cause?: unknown) {
    super('The object store could not be reached', { cause });
  }
}

class RateLimitedException extends InfrastructureException {
  override readonly code = 'RATE_LIMITED';
  override readonly status = 503;

  constructor() {
    super('The provider is rate limiting us');
  }
}

describe('InfrastructureException', () => {
  it('is an error, so it can be thrown and caught like one', () => {
    const failure = new StorageUnreachableException();

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(InfrastructureException);
  });

  it('names itself after the machinery that failed', () => {
    expect(new StorageUnreachableException().name).toBe(
      'StorageUnreachableException',
    );
  });

  it('carries the stable code a client matches on', () => {
    expect(new StorageUnreachableException().code).toBe('STORAGE_UNREACHABLE');
  });

  it('answers with 500 unless it says otherwise', () => {
    expect(new StorageUnreachableException().status).toBe(500);
  });

  it('lets a failure that means something else name its own status', () => {
    expect(new RateLimitedException().status).toBe(503);
  });

  it('keeps the failure underneath it, so the stack is not lost', () => {
    const underlying = new Error('ECONNREFUSED');

    expect(new StorageUnreachableException(underlying).cause).toBe(underlying);
  });

  it('is caught by class', () => {
    expect(() => {
      throw new StorageUnreachableException();
    }).toThrow(StorageUnreachableException);
  });
});

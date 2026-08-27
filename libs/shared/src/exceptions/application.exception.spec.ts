import { describe, expect, it } from 'vitest';

import { ApplicationException } from './application.exception.js';

class ThingNotFoundException extends ApplicationException {
  override readonly code = 'THING_NOT_FOUND';

  constructor(public readonly thingId: string) {
    super(`No thing ${thingId}`);
  }
}

class NotAuthenticatedException extends ApplicationException {
  override readonly code = 'NOT_AUTHENTICATED';
  override readonly status = 401;

  constructor() {
    super('The caller is not authenticated');
  }
}

describe('ApplicationException', () => {
  it('is an error, so it can be thrown and caught like one', () => {
    const failure = new ThingNotFoundException('42');

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(ApplicationException);
  });

  it('names itself after what the use case could not do', () => {
    expect(new ThingNotFoundException('42').name).toBe(
      'ThingNotFoundException',
    );
  });

  it('carries the stable code a client matches on', () => {
    expect(new ThingNotFoundException('42').code).toBe('THING_NOT_FOUND');
  });

  it('answers the caller with 400 unless it says otherwise', () => {
    expect(new ThingNotFoundException('42').status).toBe(400);
  });

  it('lets a case that means something else name its own status', () => {
    expect(new NotAuthenticatedException().status).toBe(401);
  });

  it('is caught by class', () => {
    expect(() => {
      throw new ThingNotFoundException('42');
    }).toThrow(ThingNotFoundException);
  });
});

import { describe, expect, it } from 'vitest';

import { boundContext } from './bind-context.js';

/** What Nest passes as the second argument of `error()`. */
function aStack(): string {
  return 'Error: boom\n    at recognise (ocr.adapter.ts:120:5)';
}

describe('boundContext', () => {
  it('files the caller’s own fields under context', () => {
    // arrange
    const context = { packageId: 'a3f', durationMs: 12 };

    // act
    const bound = boundContext(context);

    // assert
    expect(bound).toEqual({ context: { packageId: 'a3f', durationMs: 12 } });
  });

  it('reads a plain string as the name of the emitting class', () => {
    // act / assert
    expect(boundContext('RunVerificationHandler')).toEqual({
      context: { scope: 'RunVerificationHandler' },
    });
  });

  it('reads a string of stack frames as a stack, not as a name', () => {
    // Nest calls error(message, stack, scope): the stack arrives where our own
    // callers put the class name, and filed under "scope" it is unreadable.

    // act / assert
    expect(boundContext(aStack())).toEqual({ stack: aStack() });
  });

  it('unpacks an Error, whose message and stack JSON would drop', () => {
    // arrange
    const error = new Error('the reader is down');

    // act
    const bound = boundContext({ error });

    // assert
    expect(JSON.stringify(bound)).toContain('the reader is down');
    expect(bound).toMatchObject({
      context: { error: { name: 'Error', message: 'the reader is down' } },
    });
  });

  it('adds nothing when there is nothing to add', () => {
    // act / assert
    expect(boundContext(undefined)).toEqual({});
  });
});

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
    expect(boundContext(aStack())).toEqual({ err: { stack: aStack() } });
  });

  it('raises the Error a caller passed to the key pino serialises', () => {
    // arrange
    const error = new Error('the reader is down');

    // act
    const bound = boundContext({ error, sheet: 7 });

    // assert
    expect(bound).toEqual({ err: error, context: { sheet: 7 } });
  });

  it('describes a second Error by hand, since only the first can be err', () => {
    // arrange
    const first = new Error('the reader is down');
    const second = new Error('and so is the bucket');

    // act
    const bound = boundContext({ first, second });

    // assert — a plain object would serialise to `{}`: both fields are
    // non-enumerable on an Error.
    expect(bound).toEqual({
      err: first,
      context: {
        second: {
          name: 'Error',
          message: 'and so is the bucket',
          stack: second.stack,
        },
      },
    });
  });

  it('adds nothing when there is nothing to add', () => {
    // act / assert
    expect(boundContext(undefined)).toEqual({});
  });
});
